import { describe, expect, it } from "vitest";
import { Note } from "./note";

describe("Note", () => {
  it("creates a note with a non-empty title", () => {
    const note = Note.create({
      id: "note-1",
      userId: "user-1",
      title: "First Note"
    });

    expect(note.id).toBe("note-1");
    expect(note.userId).toBe("user-1");
    expect(note.title).toBe("First Note");
    expect(note.version).toBe(1);
    expect(note.deletedAt).toBeNull();
  });

  it("rejects blank titles", () => {
    expect(() => {
      Note.create({
        id: "note-1",
        userId: "user-1",
        title: "   "
      });
    }).toThrowError("title must not be empty");
  });

  it("renames note and increments version", () => {
    const note = Note.create({
      id: "note-1",
      userId: "user-1",
      title: "First Note"
    });

    note.rename("Renamed Note");

    expect(note.title).toBe("Renamed Note");
    expect(note.version).toBe(2);
  });

  it("soft deletes note and prevents renaming after delete", () => {
    const note = Note.create({
      id: "note-1",
      userId: "user-1",
      title: "First Note"
    });

    note.softDelete(new Date("2026-07-11T00:00:00.000Z"));

    expect(note.deletedAt?.toISOString()).toBe("2026-07-11T00:00:00.000Z");
    expect(note.version).toBe(2);
    expect(() => note.rename("After Delete")).toThrowError("cannot rename deleted note");
  });
});
