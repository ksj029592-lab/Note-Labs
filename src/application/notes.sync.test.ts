import { describe, expect, it } from "vitest";
import { InMemoryNoteRepository } from "./notes.repository.in-memory";
import { NotesService } from "./notes.service";

describe("NotesService sync conflict policy", () => {
  it("renames note when expectedVersion matches", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Original"
    });

    const result = await service.renameNote({
      noteId: "note-1",
      userId: "user-1",
      title: "Updated",
      expectedVersion: 1
    });

    expect(result.status).toBe("updated");
    if (result.status === "updated") {
      expect(result.note.title).toBe("Updated");
      expect(result.note.version).toBe(2);
    }
  });

  it("creates conflict copy when expectedVersion is stale", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    const note = await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Original"
    });

    await service.renameNote({
      noteId: note.id,
      userId: note.userId,
      title: "Updated Once",
      expectedVersion: 1
    });

    const result = await service.renameNote({
      noteId: note.id,
      userId: note.userId,
      title: "Stale Update",
      expectedVersion: 1
    });

    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.conflictCopy.originalNoteId).toBe("note-1");
      expect(result.conflictCopy.expectedVersion).toBe(1);
      expect(result.conflictCopy.actualVersion).toBe(2);
      expect(result.conflictCopy.attemptedTitle).toBe("Stale Update");
    }

    const conflicts = await service.listConflictCopies("note-1");
    expect(conflicts).toHaveLength(1);
  });
});
