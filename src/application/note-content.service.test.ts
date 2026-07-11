import { describe, expect, it } from "vitest";
import { InMemoryNotePageContentRepository } from "./note-page-content.repository.in-memory";
import { InMemoryNoteRepository } from "./notes.repository.in-memory";
import { NotesService } from "./notes.service";
import { NoteContentService } from "./note-content.service";
import { InMemoryStrokeRepository } from "./stroke.repository.in-memory";
import type { NoteContentTransactionalWriterPort } from "./note-content-transaction.port";

describe("NoteContentService", () => {
  it("saves pages and strokes together", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const notesService = new NotesService(noteRepository);
    const service = new NoteContentService(noteRepository, pageRepository, strokeRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Combined"
    });

    const result = await service.saveNoteContent({
      noteId: "note-1",
      userId: "user-1",
      expectedVersion: 1,
      pages: [
        { pageIndex: 1, text: "second" },
        { pageIndex: 0, text: "first" }
      ],
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
    });

    expect(result.status).toBe("updated");
    if (result.status === "updated") {
      expect(result.content.pages).toHaveLength(2);
      expect(result.content.pages[0].pageIndex).toBe(0);
      expect(result.content.strokes).toHaveLength(1);
      expect(result.content.strokes[0].toolType).toBe("pen");
      expect(result.noteVersion).toBe(2);
    }
  });

  it("throws for forbidden user", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const notesService = new NotesService(noteRepository);
    const service = new NoteContentService(noteRepository, pageRepository, strokeRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "owner",
      title: "Combined"
    });

    await expect(
      service.saveNoteContent({
        noteId: "note-1",
        userId: "intruder",
        expectedVersion: 1,
        pages: [],
        strokes: []
      })
    ).rejects.toThrowError("forbidden");
  });

  it("creates conflict copy when expectedVersion is stale", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const notesService = new NotesService(noteRepository);
    const service = new NoteContentService(noteRepository, pageRepository, strokeRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Combined"
    });

    await service.saveNoteContent({
      noteId: "note-1",
      userId: "user-1",
      expectedVersion: 1,
      pages: [{ pageIndex: 0, text: "first" }],
      strokes: []
    });

    const result = await service.saveNoteContent({
      noteId: "note-1",
      userId: "user-1",
      expectedVersion: 1,
      pages: [{ pageIndex: 0, text: "stale" }],
      strokes: []
    });

    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.conflictCopy.expectedVersion).toBe(1);
      expect(result.conflictCopy.actualVersion).toBe(2);
      expect(result.conflictCopy.attemptedPayloadHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.conflictCopy.attemptedPagesCount).toBe(1);
      expect(result.conflictCopy.attemptedStrokesCount).toBe(0);
    }
  });

  it("uses transactional writer when provided", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const notesService = new NotesService(noteRepository);

    const transactionalWriter: NoteContentTransactionalWriterPort = {
      replaceNoteContentAtomically: async () => ({
        status: "updated",
        noteVersion: 2
      })
    };

    const service = new NoteContentService(
      noteRepository,
      pageRepository,
      strokeRepository,
      transactionalWriter
    );

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Combined"
    });

    const result = await service.saveNoteContent({
      noteId: "note-1",
      userId: "user-1",
      expectedVersion: 1,
      pages: [{ pageIndex: 0, text: "first" }],
      strokes: []
    });

    expect(result.status).toBe("updated");
    if (result.status === "updated") {
      expect(result.noteVersion).toBe(2);
    }
  });
});
