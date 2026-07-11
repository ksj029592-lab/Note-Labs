import { describe, expect, it, vi } from "vitest";
import { PostgresNoteContentTransactionalWriter } from "./postgres-note-content-transactional-writer";

describe("PostgresNoteContentTransactionalWriter", () => {
  it("commits when expectedVersion matches", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("select version")) {
        return { rowCount: 1, rows: [{ version: 3 }] };
      }

      return { rowCount: 1, rows: [] };
    });

    const writer = new PostgresNoteContentTransactionalWriter({ query });
    const result = await writer.replaceNoteContentAtomically({
      noteId: "note-1",
      expectedVersion: 3,
      pages: [{ pageIndex: 0, text: "first" }],
      strokes: []
    });

    expect(result).toEqual({ status: "updated", noteVersion: 4 });
    const calls = query.mock.calls.map((call) => String(call[0]).toLowerCase());
    expect(calls[0]).toContain("begin");
    expect(calls.some((sql) => sql.includes("update notes"))).toBe(true);
    expect(calls.at(-1)).toContain("commit");
  });

  it("rolls back and returns conflict when expectedVersion is stale", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("select version")) {
        return { rowCount: 1, rows: [{ version: 5 }] };
      }

      return { rowCount: 1, rows: [] };
    });

    const writer = new PostgresNoteContentTransactionalWriter({ query });
    const result = await writer.replaceNoteContentAtomically({
      noteId: "note-1",
      expectedVersion: 4,
      pages: [],
      strokes: []
    });

    expect(result).toEqual({ status: "conflict", actualVersion: 5 });
    const calls = query.mock.calls.map((call) => String(call[0]).toLowerCase());
    expect(calls).toContain("rollback");
    expect(calls.some((sql) => sql.includes("delete from note_pages"))).toBe(false);
  });
});
