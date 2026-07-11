import { describe, expect, it, vi } from "vitest";
import { createStrokeProviderFromEnv } from "./stroke-provider-factory";
import type { StrokeRepositoryPort } from "../application/stroke.port";

function makeRepositoryDouble(tag: string): StrokeRepositoryPort & { tag: string } {
  return {
    tag,
    listByNoteId: async () => [],
    replaceByNoteId: async () => undefined
  };
}

describe("createStrokeProviderFromEnv", () => {
  it("returns undefined when DATABASE_URL is not set", () => {
    const makePostgresStrokeRepository = vi.fn();

    const provider = createStrokeProviderFromEnv({}, makePostgresStrokeRepository);

    expect(provider).toBeUndefined();
    expect(makePostgresStrokeRepository).not.toHaveBeenCalled();
  });

  it("returns postgres stroke repository when DATABASE_URL is set", () => {
    const postgres = makeRepositoryDouble("postgres-strokes");
    const makePostgresStrokeRepository = vi.fn(() => postgres);

    const provider = createStrokeProviderFromEnv(
      { DATABASE_URL: "postgres://user:pass@localhost:5432/db" },
      makePostgresStrokeRepository
    );

    expect(provider).toBe(postgres);
    expect(makePostgresStrokeRepository).toHaveBeenCalledWith("postgres://user:pass@localhost:5432/db");
  });
});
