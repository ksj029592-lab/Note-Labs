import { describe, expect, it } from "vitest";
import { InMemoryNoteRepository } from "./notes.repository.in-memory";
import { NotesService } from "./notes.service";

describe("NotesService", () => {
  it("creates a note and returns it", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    const created = await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "My Note"
    });

    expect(created.id).toBe("note-1");
    expect(created.userId).toBe("user-1");
    expect(created.title).toBe("My Note");
    expect(created.version).toBe(1);
  });

  it("lists notes only for the user", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "User1-1"
    });

    await service.createNote({
      id: "note-2",
      userId: "user-1",
      title: "User1-2"
    });

    await service.createNote({
      id: "note-3",
      userId: "user-2",
      title: "User2-1"
    });

    const list = await service.listNotes("user-1");
    expect(list).toHaveLength(2);
    expect(list.map((note) => note.id)).toEqual(["note-1", "note-2"]);
  });
});
