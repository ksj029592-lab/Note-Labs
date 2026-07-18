import express, { type RequestHandler, Request, Response } from "express";
import path from "node:path";
import { AuthService } from "../application/auth.service";
import { NoteContentService } from "../application/note-content.service";
import type { NotePageContent } from "../application/note-page-content.port";
import { NotePageContentService } from "../application/note-page-content.service";
import { NotesService } from "../application/notes.service";
import { PdfExportService } from "../application/pdf-export.service";
import type { NoteStroke } from "../application/stroke.port";
import { StrokeService } from "../application/stroke.service";
import { handleHttpRequest } from "../interfaces/http/notes.http";
import { createRequireEntraAuth, type VerifyEntraAccessToken } from "./auth/entra-auth";
import { createRequireLocalAuth, readBearerToken } from "./auth/local-auth";

export type AppOptions = {
  requireAuth?: boolean;
  verifyToken?: VerifyEntraAccessToken;
  authService?: AuthService;
  pdfExportService?: PdfExportService;
  notePageContentService?: NotePageContentService;
  strokeService?: StrokeService;
  noteContentService?: NoteContentService;
};

function toQueryRecord(query: Request["query"]): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }

  return record;
}

function isNotePageContentArray(value: unknown): value is NotePageContent[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((page) => {
    if (!page || typeof page !== "object") {
      return false;
    }

    const candidate = page as Record<string, unknown>;
    return typeof candidate.pageIndex === "number" && typeof candidate.text === "string";
  });
}

function isNoteStrokeArray(value: unknown): value is NoteStroke[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((stroke) => {
    if (!stroke || typeof stroke !== "object") {
      return false;
    }

    const candidate = stroke as Record<string, unknown>;

    if (
      typeof candidate.toolType !== "string" ||
      typeof candidate.color !== "string" ||
      typeof candidate.width !== "number" ||
      !Array.isArray(candidate.points)
    ) {
      return false;
    }

    return candidate.points.every((point) => {
      if (!point || typeof point !== "object") {
        return false;
      }

      const pointCandidate = point as Record<string, unknown>;
      return typeof pointCandidate.x === "number" && typeof pointCandidate.y === "number";
    });
  });
}

function isSyncBody(
  value: unknown
): value is { userId?: string; expectedVersion: number; pages: NotePageContent[]; strokes: NoteStroke[] } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (typeof candidate.userId === "undefined" || typeof candidate.userId === "string") &&
    typeof candidate.expectedVersion === "number" &&
    isNotePageContentArray(candidate.pages) &&
    isNoteStrokeArray(candidate.strokes)
  );
}

export function createApp(notesService: NotesService, options: AppOptions = {}) {
  const app = express();
  const publicDir = path.resolve(process.cwd(), "public");
  const syncResponses = new Map<string, { status: number; body: unknown }>();

  app.use(express.static(publicDir));
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  if (options.authService) {
    app.post("/auth/signup", async (req: Request, res: Response) => {
      const username = typeof req.body?.username === "string" ? req.body.username : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      try {
        const result = await options.authService!.signup({ username, password });
        res.status(201).json(result);
      } catch (error) {
        res.status(400).json({ message: (error as Error).message });
      }
    });

    app.post("/auth/login", async (req: Request, res: Response) => {
      const username = typeof req.body?.username === "string" ? req.body.username : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      try {
        const result = await options.authService!.login({ username, password });
        res.status(200).json(result);
      } catch (error) {
        res.status(401).json({ message: (error as Error).message });
      }
    });

    app.get("/auth/me", async (req: Request, res: Response) => {
      const token = readBearerToken(req.header("Authorization"));
      if (!token) {
        res.status(401).json({ message: "missing bearer token" });
        return;
      }

      try {
        const verified = await options.authService!.verifyToken(token);
        res.status(200).json({ userId: verified.userId, username: verified.username });
      } catch {
        res.status(401).json({ message: "invalid access token" });
      }
    });

    app.post("/auth/logout", async (req: Request, res: Response) => {
      const token = readBearerToken(req.header("Authorization"));
      if (!token) {
        res.status(401).json({ message: "missing bearer token" });
        return;
      }

      await options.authService!.logout(token);
      res.status(204).send();
    });
  }

  const exportPdfHandler = async (req: Request, res: Response) => {
    if (!options.pdfExportService) {
      res.status(501).json({ message: "pdf export service is not configured" });
      return;
    }

    const noteIdParam = req.params.noteId;
    const noteId = Array.isArray(noteIdParam) ? noteIdParam[0] : noteIdParam;
    const userId =
      typeof res.locals.userId === "string"
        ? res.locals.userId
        : typeof req.body?.userId === "string"
          ? req.body.userId
          : undefined;

    if (!noteId || !userId) {
      res.status(400).json({ message: "userId is required" });
      return;
    }

    try {
      const exported = await options.pdfExportService.exportNoteAsPdf({ noteId, userId });
      res.status(201).json(exported);
    } catch (error) {
      const message = (error as Error).message;

      if (message === "note not found") {
        res.status(404).json({ message });
        return;
      }

      if (message === "forbidden") {
        res.status(403).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  };

  const syncHandler = async (req: Request, res: Response) => {
    if (!options.noteContentService) {
      res.status(501).json({ message: "note content service is not configured" });
      return;
    }

    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey) {
      res.status(400).json({ message: "Idempotency-Key header is required" });
      return;
    }

    const cached = syncResponses.get(idempotencyKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    if (!isSyncBody(req.body)) {
      res.status(400).json({ message: "invalid request body" });
      return;
    }

    const noteIdParam = req.params.noteId;
    const noteId = Array.isArray(noteIdParam) ? noteIdParam[0] : noteIdParam;

    if (!noteId) {
      res.status(400).json({ message: "noteId path param is required" });
      return;
    }

    try {
      const requestUserId =
        typeof res.locals.userId === "string"
          ? res.locals.userId
          : typeof req.body?.userId === "string"
            ? req.body.userId
            : undefined;

      if (!requestUserId) {
        res.status(400).json({ message: "userId is required" });
        return;
      }

      const content = await options.noteContentService.saveNoteContent({
        noteId,
        userId: requestUserId,
        expectedVersion: req.body.expectedVersion,
        pages: req.body.pages,
        strokes: req.body.strokes
      });

      if (content.status === "conflict") {
        const mergeCandidate = {
          conflictCopyId: content.conflictCopy.id,
          expectedVersion: content.conflictCopy.expectedVersion,
          actualVersion: content.conflictCopy.actualVersion,
          attemptedPagesCount: content.conflictCopy.attemptedPagesCount ?? 0,
          attemptedStrokesCount: content.conflictCopy.attemptedStrokesCount ?? 0,
          attemptedPayloadHash: content.conflictCopy.attemptedPayloadHash ?? null,
          createdAt: content.conflictCopy.createdAt.toISOString()
        };

        const responseBody = {
          status: "conflict",
          serverVersion: content.conflictCopy.actualVersion,
          conflictRegions: [],
          mergeCandidates: [mergeCandidate]
        };

        syncResponses.set(idempotencyKey, { status: 409, body: responseBody });
        res.status(409).json(responseBody);
        return;
      }

      const responseBody = {
        status: "updated",
        noteVersion: content.noteVersion,
        pages: content.content.pages,
        strokes: content.content.strokes
      };

      syncResponses.set(idempotencyKey, { status: 200, body: responseBody });
      res.status(200).json(responseBody);
    } catch (error) {
      const message = (error as Error).message;

      if (message === "note not found") {
        res.status(404).json({ message });
        return;
      }

      if (message === "forbidden") {
        res.status(403).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  };

  const conflictListHandler = async (req: Request, res: Response) => {
    const originalNoteId =
      typeof req.query.originalNoteId === "string" ? req.query.originalNoteId : undefined;

    if (!originalNoteId) {
      res.status(400).json({ message: "originalNoteId query is required" });
      return;
    }

    const conflicts = await notesService.listConflictCopies(originalNoteId);
    res.status(200).json(conflicts);
  };

  const notesHandler = async (req: Request, res: Response) => {
    const query = toQueryRecord(req.query);
    const authenticatedUserId =
      typeof res.locals.userId === "string" ? res.locals.userId : undefined;

    if (authenticatedUserId) {
      query.userId = authenticatedUserId;
    }

    let body: unknown = req.body ?? null;
    if (
      authenticatedUserId &&
      body &&
      typeof body === "object" &&
      !Array.isArray(body)
    ) {
      body = {
        ...(body as Record<string, unknown>),
        userId: authenticatedUserId
      };
    }

    const response = await handleHttpRequest(
      {
        method: req.method as "GET" | "POST",
        path: req.path,
        query,
        body
      },
      notesService,
      options.notePageContentService,
      options.strokeService,
      options.noteContentService
    );

    res.status(response.status).json(response.body);
  };

  let protectedMiddlewares: RequestHandler[] = [];

  if (options.authService) {
    protectedMiddlewares = [createRequireLocalAuth(options.authService)];
  } else if (options.requireAuth) {
    if (!options.verifyToken) {
      throw new Error("verifyToken is required when requireAuth is true");
    }

    protectedMiddlewares = [createRequireEntraAuth(options.verifyToken)];
  }

  app.post("/notes/:noteId/export/pdf", ...protectedMiddlewares, exportPdfHandler);

  app.post("/api/notebooks/:noteId/sync", ...protectedMiddlewares, syncHandler);
  app.get("/notes/conflicts", ...protectedMiddlewares, conflictListHandler);
  app.all(
    ["/notes", "/notes/rename", "/notes/pages", "/notes/strokes", "/notes/content"],
    ...protectedMiddlewares,
    notesHandler
  );

  return app;
}
