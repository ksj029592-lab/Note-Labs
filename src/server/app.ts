import express, { Request, Response } from "express";
import { NoteContentService } from "../application/note-content.service";
import { NotePageContentService } from "../application/note-page-content.service";
import { NotesService } from "../application/notes.service";
import { PdfExportService } from "../application/pdf-export.service";
import { StrokeService } from "../application/stroke.service";
import { handleHttpRequest } from "../interfaces/http/notes.http";
import { createRequireEntraAuth, type VerifyEntraAccessToken } from "./auth/entra-auth";

export type AppOptions = {
  requireAuth?: boolean;
  verifyToken?: VerifyEntraAccessToken;
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

export function createApp(notesService: NotesService, options: AppOptions = {}) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/notes/:noteId/export/pdf", async (req: Request, res: Response) => {
    if (!options.pdfExportService) {
      res.status(501).json({ message: "pdf export service is not configured" });
      return;
    }

    const noteIdParam = req.params.noteId;
    const noteId = Array.isArray(noteIdParam) ? noteIdParam[0] : noteIdParam;
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;

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
  });

  const notesHandler = async (req: Request, res: Response) => {
    const response = await handleHttpRequest(
      {
        method: req.method as "GET" | "POST",
        path: req.path,
        query: toQueryRecord(req.query),
        body: req.body ?? null
      },
      notesService,
      options.notePageContentService,
      options.strokeService,
      options.noteContentService
    );

    res.status(response.status).json(response.body);
  };

  if (options.requireAuth) {
    if (!options.verifyToken) {
      throw new Error("verifyToken is required when requireAuth is true");
    }

    const requireEntraAuth = createRequireEntraAuth(options.verifyToken);
    app.all(
      ["/notes", "/notes/rename", "/notes/pages", "/notes/strokes", "/notes/content"],
      requireEntraAuth,
      notesHandler
    );
  } else {
    app.all(["/notes", "/notes/rename", "/notes/pages", "/notes/strokes", "/notes/content"], notesHandler);
  }

  return app;
}
