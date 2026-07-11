import { describe, expect, it } from "vitest";
import { InMemoryNotePageContentRepository } from "../../application/note-page-content.repository.in-memory";
import { NoteContentService } from "../../application/note-content.service";
import { NotePageContentService } from "../../application/note-page-content.service";
import { InMemoryNoteRepository } from "../../application/notes.repository.in-memory";
import { NotesService } from "../../application/notes.service";
import { InMemoryStrokeRepository } from "../../application/stroke.repository.in-memory";
import { StrokeService } from "../../application/stroke.service";
import { handleHttpRequest } from "./notes.http";

function asBody<T>(value: unknown): T {
  return value as T;
}

describe("notes.http", () => {
  it("creates note with POST /notes", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes",
        query: {},
        body: {
          id: "note-1",
          userId: "user-1",
          title: "First Note"
        }
      },
      service
    );

    expect(response.status).toBe(201);
    const body = asBody<{ id: string; userId: string; title: string }>(response.body);
    expect(body.id).toBe("note-1");
    expect(body.userId).toBe("user-1");
    expect(body.title).toBe("First Note");
  });

  it("returns 400 when creating note with empty title", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes",
        query: {},
        body: {
          id: "note-1",
          userId: "user-1",
          title: "   "
        }
      },
      service
    );

    expect(response.status).toBe(400);
    const body = asBody<{ message: string }>(response.body);
    expect(body.message).toBe("title must not be empty");
  });

  it("lists notes with GET /notes?userId=user-1", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    await service.createNote({ id: "note-1", userId: "user-1", title: "A" });
    await service.createNote({ id: "note-2", userId: "user-1", title: "B" });
    await service.createNote({ id: "note-3", userId: "user-2", title: "C" });

    const response = await handleHttpRequest(
      {
        method: "GET",
        path: "/notes",
        query: { userId: "user-1" },
        body: null
      },
      service
    );

    expect(response.status).toBe(200);
    const body = asBody<Array<{ id: string }>>(response.body);
    expect(body).toHaveLength(2);
    expect(body.map((note) => note.id)).toEqual(["note-1", "note-2"]);
  });

  it("returns 400 when userId query is missing for GET /notes", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    const response = await handleHttpRequest(
      {
        method: "GET",
        path: "/notes",
        query: {},
        body: null
      },
      service
    );

    expect(response.status).toBe(400);
    const body = asBody<{ message: string }>(response.body);
    expect(body.message).toBe("userId query is required");
  });

  it("renames note with POST /notes/rename", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Original"
    });

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/rename",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          title: "Updated",
          expectedVersion: 1
        }
      },
      service
    );

    expect(response.status).toBe(200);
    const body = asBody<{ title: string; version: number }>(response.body);
    expect(body.title).toBe("Updated");
    expect(body.version).toBe(2);
  });

  it("returns 409 conflict when rename expectedVersion is stale", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Original"
    });

    await service.renameNote({
      noteId: "note-1",
      userId: "user-1",
      title: "Updated Once",
      expectedVersion: 1
    });

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/rename",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          title: "Stale Update",
          expectedVersion: 1
        }
      },
      service
    );

    expect(response.status).toBe(409);
    const body = asBody<{ message: string; conflictCopyId: string }>(response.body);
    expect(body.message).toBe("version conflict");
    expect(body.conflictCopyId).toContain("conflict-note-1-");
  });

  it("saves note pages with POST /notes/pages", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pageService = new NotePageContentService(repo, new InMemoryNotePageContentRepository());

    await service.createNote({ id: "note-1", userId: "user-1", title: "Paged" });

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/pages",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          pages: [
            { pageIndex: 1, text: "second" },
            { pageIndex: 0, text: "first" }
          ]
        }
      },
      service,
      pageService
    );

    expect(response.status).toBe(200);
    const body = asBody<Array<{ pageIndex: number; text: string }>>(response.body);
    expect(body).toEqual([
      { pageIndex: 0, text: "first" },
      { pageIndex: 1, text: "second" }
    ]);
  });

  it("lists note pages with GET /notes/pages", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pageService = new NotePageContentService(repo, new InMemoryNotePageContentRepository());

    await service.createNote({ id: "note-1", userId: "user-1", title: "Paged" });
    await pageService.saveNotePages({
      noteId: "note-1",
      userId: "user-1",
      pages: [
        { pageIndex: 0, text: "first" },
        { pageIndex: 1, text: "second" }
      ]
    });

    const response = await handleHttpRequest(
      {
        method: "GET",
        path: "/notes/pages",
        query: { noteId: "note-1", userId: "user-1" },
        body: null
      },
      service,
      pageService
    );

    expect(response.status).toBe(200);
    const body = asBody<Array<{ pageIndex: number; text: string }>>(response.body);
    expect(body).toHaveLength(2);
  });

  it("saves note strokes with POST /notes/strokes", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const strokeService = new StrokeService(repo, new InMemoryStrokeRepository());

    await service.createNote({ id: "note-1", userId: "user-1", title: "Stroked" });

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/strokes",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          strokes: [
            {
              pageIndex: 0,
              toolType: "pen",
              color: "#111111",
              width: 2,
              points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 }
              ]
            }
          ]
        }
      },
      service,
      undefined,
      strokeService
    );

    expect(response.status).toBe(200);
    const body = asBody<Array<{ toolType: string }>>(response.body);
    expect(body).toHaveLength(1);
    expect(body[0].toolType).toBe("pen");
  });

  it("lists note strokes with GET /notes/strokes", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const strokeService = new StrokeService(repo, new InMemoryStrokeRepository());

    await service.createNote({ id: "note-1", userId: "user-1", title: "Stroked" });
    await strokeService.saveNoteStrokes({
      noteId: "note-1",
      userId: "user-1",
      strokes: [
        {
          pageIndex: 0,
          toolType: "highlighter",
          color: "#abcdef",
          width: 5,
          points: [
            { x: 10, y: 20 },
            { x: 30, y: 40 }
          ]
        }
      ]
    });

    const response = await handleHttpRequest(
      {
        method: "GET",
        path: "/notes/strokes",
        query: { noteId: "note-1", userId: "user-1" },
        body: null
      },
      service,
      undefined,
      strokeService
    );

    expect(response.status).toBe(200);
    const body = asBody<Array<{ toolType: string }>>(response.body);
    expect(body).toHaveLength(1);
    expect(body[0].toolType).toBe("highlighter");
  });

  it("saves note content with POST /notes/content", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const contentService = new NoteContentService(repo, pageRepository, strokeRepository);

    await service.createNote({ id: "note-1", userId: "user-1", title: "Content" });

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/content",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          expectedVersion: 1,
          pages: [{ pageIndex: 0, text: "first" }],
          strokes: [
            {
              pageIndex: 0,
              toolType: "pen",
              color: "#111111",
              width: 2,
              points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 }
              ]
            }
          ]
        }
      },
      service,
      undefined,
      undefined,
      contentService
    );

    expect(response.status).toBe(200);
    const body = asBody<{ pages: Array<{ pageIndex: number }>; strokes: Array<{ toolType: string }> }>(
      response.body
    );
    expect(body.pages).toHaveLength(1);
    expect(body.strokes).toHaveLength(1);
  });

  it("returns 409 for stale expectedVersion on /notes/content", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const contentService = new NoteContentService(repo, pageRepository, strokeRepository);

    await service.createNote({ id: "note-1", userId: "user-1", title: "Content" });

    await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/content",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          expectedVersion: 1,
          pages: [{ pageIndex: 0, text: "first" }],
          strokes: []
        }
      },
      service,
      undefined,
      undefined,
      contentService
    );

    const response = await handleHttpRequest(
      {
        method: "POST",
        path: "/notes/content",
        query: {},
        body: {
          noteId: "note-1",
          userId: "user-1",
          expectedVersion: 1,
          pages: [{ pageIndex: 0, text: "stale" }],
          strokes: []
        }
      },
      service,
      undefined,
      undefined,
      contentService
    );

    expect(response.status).toBe(409);
    const body = asBody<{ message: string; conflictCopyId: string }>(response.body);
    expect(body.message).toBe("version conflict");
    expect(body.conflictCopyId).toContain("conflict-note-1-");

    const conflicts = await service.listConflictCopies("note-1");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].attemptedPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(conflicts[0].attemptedPagesCount).toBe(1);
    expect(conflicts[0].attemptedStrokesCount).toBe(0);
  });
});
