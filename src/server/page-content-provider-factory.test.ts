import { describe, expect, it, vi } from "vitest";
import { createPageContentProviderFromEnv } from "./page-content-provider-factory";
import type { NotePageContentRepositoryPort } from "../application/note-page-content.port";

function makeProviderDouble(tag: string): NotePageContentRepositoryPort & { tag: string } {
  return {
    tag,
    listPageContentsByNoteId: async () => [],
    replacePageContents: async () => undefined
  };
}

describe("createPageContentProviderFromEnv", () => {
  it("returns undefined when DATABASE_URL is not set", () => {
    const makePostgresProvider = vi.fn();

    const provider = createPageContentProviderFromEnv({}, makePostgresProvider);

    expect(provider).toBeUndefined();
    expect(makePostgresProvider).not.toHaveBeenCalled();
  });

  it("returns postgres page content provider when DATABASE_URL is set", () => {
    const postgresProvider = makeProviderDouble("postgres-page-content");
    const makePostgresProvider = vi.fn(() => postgresProvider);

    const provider = createPageContentProviderFromEnv(
      { DATABASE_URL: "postgres://user:pass@localhost:5432/db" },
      makePostgresProvider
    );

    expect(provider).toBe(postgresProvider);
    expect(makePostgresProvider).toHaveBeenCalledWith("postgres://user:pass@localhost:5432/db");
  });
});
