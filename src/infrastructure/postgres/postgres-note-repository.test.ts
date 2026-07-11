import { describe, expect, it, vi } from "vitest";
import { Note } from "../../domain/note";
import { PostgresNoteRepository } from "./postgres-note-repository";

describe("PostgresNoteRepository", () => {
  it("upserts note on save", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 1 }));
    const repository = new PostgresNoteRepository({ query });
    const note = Note.create({ id: "note-1", userId: "user-1", title: "First" });

    await repository.save(note);

    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0]?.[0] as string;
    const params = query.mock.calls[0]?.[1] as unknown[];
    expect(sql).toContain("insert into notes");
    expect(params).toEqual(["note-1", "user-1", "First", 1, null]);
  });

  it("returns null when note is not found", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 }));
    const repository = new PostgresNoteRepository({ query });

    const note = await repository.findById("missing");

    expect(note).toBeNull();
  });

  it("maps database row to Note", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          id: "note-1",
          user_id: "user-1",
          title: "Persisted",
          version: 3,
          deleted_at: null
        }
      ]
    }));

    const repository = new PostgresNoteRepository({ query });
    const note = await repository.findById("note-1");

    expect(note?.id).toBe("note-1");
    expect(note?.userId).toBe("user-1");
    expect(note?.title).toBe("Persisted");
    expect(note?.version).toBe(3);
  });

  it("stores and lists conflict copies", async () => {
    let callCount = 0;
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => {
      callCount += 1;

      if (callCount === 1) {
        return { rows: [], rowCount: 1 };
      }

      return {
        rowCount: 1,
        rows: [
          {
            id: "conflict-1",
            original_note_id: "note-1",
            user_id: "user-1",
            attempted_title: "Stale Update",
            attempted_payload_hash: "abc123",
            attempted_pages_count: 3,
            attempted_strokes_count: 12,
            expected_version: 1,
            actual_version: 2,
            created_at: new Date("2026-07-11T00:00:00.000Z")
          }
        ]
      };
    });

    const repository = new PostgresNoteRepository({ query });

    await repository.saveConflictCopy({
      id: "conflict-1",
      originalNoteId: "note-1",
      userId: "user-1",
      attemptedTitle: "Stale Update",
      attemptedPayloadHash: "abc123",
      attemptedPagesCount: 3,
      attemptedStrokesCount: 12,
      expectedVersion: 1,
      actualVersion: 2,
      createdAt: new Date("2026-07-11T00:00:00.000Z")
    });

    const conflicts = await repository.listConflictCopiesByOriginalId("note-1");

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("conflict-1");
    expect(conflicts[0].originalNoteId).toBe("note-1");
    expect(conflicts[0].attemptedPayloadHash).toBe("abc123");
    expect(conflicts[0].attemptedPagesCount).toBe(3);
    expect(conflicts[0].attemptedStrokesCount).toBe(12);
  });
});
