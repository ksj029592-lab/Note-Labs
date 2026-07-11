import { describe, expect, it, vi } from "vitest";
import type { NoteContentTransactionalWriterPort } from "../application/note-content-transaction.port";
import { createNoteContentTransactionalWriterFromEnv } from "./note-content-transaction-factory";

function makeWriterDouble(tag: string): NoteContentTransactionalWriterPort & { tag: string } {
  return {
    tag,
    replaceNoteContentAtomically: async () => ({
      status: "updated",
      noteVersion: 1
    })
  };
}

describe("createNoteContentTransactionalWriterFromEnv", () => {
  it("returns undefined when DATABASE_URL is not set", () => {
    const makeWriter = vi.fn();

    const writer = createNoteContentTransactionalWriterFromEnv({}, makeWriter);

    expect(writer).toBeUndefined();
    expect(makeWriter).not.toHaveBeenCalled();
  });

  it("returns postgres transactional writer when DATABASE_URL is set", () => {
    const writer = makeWriterDouble("postgres-note-content-tx");
    const makeWriter = vi.fn(() => writer);

    const result = createNoteContentTransactionalWriterFromEnv(
      { DATABASE_URL: "postgres://user:pass@localhost:5432/db" },
      makeWriter
    );

    expect(result).toBe(writer);
    expect(makeWriter).toHaveBeenCalledWith("postgres://user:pass@localhost:5432/db");
  });
});
