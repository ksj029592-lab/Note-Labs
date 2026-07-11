import { describe, expect, it } from "vitest";
import { NotesService } from "./notes.service";
import { InMemoryNoteRepository } from "./notes.repository.in-memory";
import { InMemoryStrokeRepository } from "./stroke.repository.in-memory";
import { StrokeService } from "./stroke.service";

describe("StrokeService", () => {
  it("saves and lists note strokes for owner", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const notesService = new NotesService(noteRepository);
    const strokeRepository = new InMemoryStrokeRepository();
    const service = new StrokeService(noteRepository, strokeRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "With Strokes"
    });

    await service.saveNoteStrokes({
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
    });

    const listed = await service.listNoteStrokes("note-1", "user-1");
    expect(listed).toHaveLength(1);
    expect(listed[0].toolType).toBe("pen");
  });

  it("throws for forbidden user", async () => {
    const noteRepository = new InMemoryNoteRepository();
    const notesService = new NotesService(noteRepository);
    const strokeRepository = new InMemoryStrokeRepository();
    const service = new StrokeService(noteRepository, strokeRepository);

    await notesService.createNote({
      id: "note-1",
      userId: "owner",
      title: "Private"
    });

    await expect(
      service.saveNoteStrokes({
        noteId: "note-1",
        userId: "intruder",
        strokes: []
      })
    ).rejects.toThrowError("forbidden");
  });
});
