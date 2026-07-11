import { NotesService } from "../../application/notes.service";
import { NoteContentService, type NoteContentSnapshot } from "../../application/note-content.service";
import { NotePageContentService } from "../../application/note-page-content.service";
import type { NotePageContent } from "../../application/note-page-content.port";
import { StrokeService } from "../../application/stroke.service";
import type { NoteStroke } from "../../application/stroke.port";
import { Note } from "../../domain/note";
import type { HttpRequest, HttpResponse } from "./http.types";

type ErrorResponse = { message: string };
type ConflictResponse = { message: string; conflictCopyId: string };

export type NotesHttpResponse =
  | HttpResponse<Note>
  | HttpResponse<Note[]>
  | HttpResponse<NotePageContent[]>
  | HttpResponse<NoteStroke[]>
  | HttpResponse<NoteContentSnapshot>
  | HttpResponse<ConflictResponse>
  | HttpResponse<ErrorResponse>;

function isCreateNoteBody(
  value: unknown
): value is { id: string; userId: string; title: string } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.title === "string"
  );
}

function isRenameNoteBody(
  value: unknown
): value is {
  noteId: string;
  userId: string;
  title: string;
  expectedVersion: number;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.noteId === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.expectedVersion === "number"
  );
}

function isSaveNotePagesBody(
  value: unknown
): value is { noteId: string; userId: string; pages: NotePageContent[] } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.noteId !== "string" ||
    typeof candidate.userId !== "string" ||
    !Array.isArray(candidate.pages)
  ) {
    return false;
  }

  return candidate.pages.every((page) => {
    if (!page || typeof page !== "object") {
      return false;
    }

    const pageCandidate = page as Record<string, unknown>;
    return (
      typeof pageCandidate.pageIndex === "number" &&
      typeof pageCandidate.text === "string"
    );
  });
}

function isSaveNoteStrokesBody(
  value: unknown
): value is { noteId: string; userId: string; strokes: NoteStroke[] } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.noteId !== "string" ||
    typeof candidate.userId !== "string" ||
    !Array.isArray(candidate.strokes)
  ) {
    return false;
  }

  return candidate.strokes.every((stroke) => {
    if (!stroke || typeof stroke !== "object") {
      return false;
    }

    const strokeCandidate = stroke as Record<string, unknown>;

    if (
      typeof strokeCandidate.toolType !== "string" ||
      typeof strokeCandidate.color !== "string" ||
      typeof strokeCandidate.width !== "number" ||
      !Array.isArray(strokeCandidate.points)
    ) {
      return false;
    }

    return strokeCandidate.points.every((point) => {
      if (!point || typeof point !== "object") {
        return false;
      }

      const pointCandidate = point as Record<string, unknown>;
      return typeof pointCandidate.x === "number" && typeof pointCandidate.y === "number";
    });
  });
}

function isSaveNoteContentBody(
  value: unknown
): value is {
  noteId: string;
  userId: string;
  expectedVersion: number;
  pages: NotePageContent[];
  strokes: NoteStroke[];
} {
  if (!isSaveNotePagesBody(value) || !isSaveNoteStrokesBody(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.expectedVersion !== "number") {
    return false;
  }

  return true;
}

export async function handleHttpRequest(
  request: HttpRequest,
  notesService: NotesService,
  notePageContentService?: NotePageContentService,
  strokeService?: StrokeService,
  noteContentService?: NoteContentService
): Promise<NotesHttpResponse> {
  if (request.method === "POST" && request.path === "/notes") {
    if (!isCreateNoteBody(request.body)) {
      return {
        status: 400,
        body: { message: "invalid request body" }
      };
    }

    try {
      const note = await notesService.createNote(request.body);
      return {
        status: 201,
        body: note
      };
    } catch (error) {
      return {
        status: 400,
        body: { message: (error as Error).message }
      };
    }
  }

  if (request.method === "GET" && request.path === "/notes") {
    const userId = request.query.userId;

    if (!userId) {
      return {
        status: 400,
        body: { message: "userId query is required" }
      };
    }

    const notes = await notesService.listNotes(userId);

    return {
      status: 200,
      body: notes
    };
  }

  if (request.method === "POST" && request.path === "/notes/rename") {
    if (!isRenameNoteBody(request.body)) {
      return {
        status: 400,
        body: { message: "invalid request body" }
      };
    }

    try {
      const result = await notesService.renameNote(request.body);

      if (result.status === "conflict") {
        return {
          status: 409,
          body: {
            message: "version conflict",
            conflictCopyId: result.conflictCopy.id
          }
        };
      }

      return {
        status: 200,
        body: result.note
      };
    } catch (error) {
      return {
        status: 400,
        body: { message: (error as Error).message }
      };
    }
  }

  if (request.method === "POST" && request.path === "/notes/pages") {
    if (!notePageContentService) {
      return {
        status: 501,
        body: { message: "note pages service is not configured" }
      };
    }

    if (!isSaveNotePagesBody(request.body)) {
      return {
        status: 400,
        body: { message: "invalid request body" }
      };
    }

    try {
      const pages = await notePageContentService.saveNotePages(request.body);
      return {
        status: 200,
        body: pages
      };
    } catch (error) {
      const message = (error as Error).message;
      return {
        status: message === "note not found" ? 404 : message === "forbidden" ? 403 : 400,
        body: { message }
      };
    }
  }

  if (request.method === "GET" && request.path === "/notes/pages") {
    if (!notePageContentService) {
      return {
        status: 501,
        body: { message: "note pages service is not configured" }
      };
    }

    const noteId = request.query.noteId;
    const userId = request.query.userId;

    if (!noteId || !userId) {
      return {
        status: 400,
        body: { message: "noteId and userId query are required" }
      };
    }

    try {
      const pages = await notePageContentService.listNotePages(noteId, userId);
      return {
        status: 200,
        body: pages
      };
    } catch (error) {
      const message = (error as Error).message;
      return {
        status: message === "note not found" ? 404 : message === "forbidden" ? 403 : 400,
        body: { message }
      };
    }
  }

  if (request.method === "POST" && request.path === "/notes/strokes") {
    if (!strokeService) {
      return {
        status: 501,
        body: { message: "stroke service is not configured" }
      };
    }

    if (!isSaveNoteStrokesBody(request.body)) {
      return {
        status: 400,
        body: { message: "invalid request body" }
      };
    }

    try {
      const strokes = await strokeService.saveNoteStrokes(request.body);
      return {
        status: 200,
        body: strokes
      };
    } catch (error) {
      const message = (error as Error).message;
      return {
        status: message === "note not found" ? 404 : message === "forbidden" ? 403 : 400,
        body: { message }
      };
    }
  }

  if (request.method === "GET" && request.path === "/notes/strokes") {
    if (!strokeService) {
      return {
        status: 501,
        body: { message: "stroke service is not configured" }
      };
    }

    const noteId = request.query.noteId;
    const userId = request.query.userId;

    if (!noteId || !userId) {
      return {
        status: 400,
        body: { message: "noteId and userId query are required" }
      };
    }

    try {
      const strokes = await strokeService.listNoteStrokes(noteId, userId);
      return {
        status: 200,
        body: strokes
      };
    } catch (error) {
      const message = (error as Error).message;
      return {
        status: message === "note not found" ? 404 : message === "forbidden" ? 403 : 400,
        body: { message }
      };
    }
  }

  if (request.method === "POST" && request.path === "/notes/content") {
    if (!noteContentService) {
      return {
        status: 501,
        body: { message: "note content service is not configured" }
      };
    }

    if (!isSaveNoteContentBody(request.body)) {
      return {
        status: 400,
        body: { message: "invalid request body" }
      };
    }

    try {
      const content = await noteContentService.saveNoteContent(request.body);

      if (content.status === "conflict") {
        return {
          status: 409,
          body: {
            message: "version conflict",
            conflictCopyId: content.conflictCopy.id
          }
        };
      }

      return {
        status: 200,
        body: content.content
      };
    } catch (error) {
      const message = (error as Error).message;
      return {
        status: message === "note not found" ? 404 : message === "forbidden" ? 403 : 400,
        body: { message }
      };
    }
  }

  return {
    status: 404,
    body: { message: "route not found" }
  };
}
