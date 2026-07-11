import { describe, expect, it } from "vitest";
import { NotesService } from "./notes.service";
import { InMemoryNoteRepository } from "./notes.repository.in-memory";
import { InMemoryNotePageContentRepository } from "./note-page-content.repository.in-memory";
import { NotePageContentService } from "./note-page-content.service";

describe("NotePageContentService", () => {
  it("saves and lists note pages for owner", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const notesService = new NotesService(noteRepository);
    const pageRepository = new InMemoryNotePageContentRepository();
    const service = new NotePageContentService(noteRepository, pageRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "With Pages"
    });

    await service.saveNotePages({
      noteId: "note-1",
      userId: "user-1",
      pages: [
        { pageIndex: 1, text: "second" },
        { pageIndex: 0, text: "first" }
      ]
    });

    const listed = await service.listNotePages("note-1", "user-1");
    expect(listed).toEqual([
      { pageIndex: 0, text: "first" },
      { pageIndex: 1, text: "second" }
    ]);
  });

  it("throws for forbidden user", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const notesService = new NotesService(noteRepository);
    const pageRepository = new InMemoryNotePageContentRepository();
    const service = new NotePageContentService(noteRepository, pageRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "owner",
      title: "Private"
    });

    await expect(
      service.saveNotePages({
        noteId: "note-1",
        userId: "intruder",
        pages: [{ pageIndex: 0, text: "hack" }]
      })
    ).rejects.toThrowError("forbidden");
  });
});
