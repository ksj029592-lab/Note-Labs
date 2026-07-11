import { describe, expect, it, vi } from "vitest";
import { createNoteRepositoryFromEnv } from "./repository-factory";
import type { NoteRepository } from "../application/notes.repository";

function makeRepositoryDouble(tag: string): NoteRepository & { tag: string } {
  return {
    tag,
    save: async () => undefined,
    findById: async () => null,
    listByUserId: async () => [],
    saveConflictCopy: async () => undefined,
    listConflictCopiesByOriginalId: async () => []
  };
}

describe("createNoteRepositoryFromEnv", () => {
  it("returns in-memory repository when DATABASE_URL is not set", () => {
    const inMemory = makeRepositoryDouble("in-memory");
    const makeInMemory = vi.fn(() => inMemory);
    const makePostgres = vi.fn();

    const repository = createNoteRepositoryFromEnv({}, makeInMemory, makePostgres);

    expect(repository).toBe(inMemory);
    expect(makeInMemory).toHaveBeenCalledTimes(1);
    expect(makePostgres).not.toHaveBeenCalled();
  });

  it("returns postgres repository when DATABASE_URL is set", () => {
    const postgres = makeRepositoryDouble("postgres");
    const makeInMemory = vi.fn(() => makeRepositoryDouble("in-memory"));
    const makePostgres = vi.fn(() => postgres);

    const repository = createNoteRepositoryFromEnv(
      { DATABASE_URL: "postgres://user:pass@localhost:5432/db" },
      makeInMemory,
      makePostgres
    );

    expect(repository).toBe(postgres);
    expect(makePostgres).toHaveBeenCalledWith("postgres://user:pass@localhost:5432/db");
    expect(makeInMemory).not.toHaveBeenCalled();
  });
});
