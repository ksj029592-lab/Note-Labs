import { describe, expect, it, vi } from "vitest";
import { runMigrations } from "./migrate";

describe("runMigrations", () => {
  it("runs .sql files in lexical order", async () => {
    const query = vi.fn<(sql: string) => Promise<void>>(async () => undefined);
    const connect = vi.fn(async () => undefined);
    const end = vi.fn(async () => undefined);

    const client = { connect, query, end };
    const createClient = vi.fn(() => client);

    const readDir = vi.fn(async () => [
      "006_conflict_payload_summary.sql",
      "005_conflict_payload_hash.sql",
      "004_note_strokes.sql",
      "002_indexes.sql",
      "001_init_notes.sql",
      "003_note_pages.sql",
      "README.md"
    ]);
    const readFile = vi.fn(async (filePath: string) => `-- ${filePath}`);

    const result = await runMigrations({
      databaseUrl: "postgres://localhost:5432/db",
      migrationsDir: "db/migrations",
      createClient,
      fsOps: { readDir, readFile }
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(6);

    const firstCall = query.mock.calls.at(0);
    const secondCall = query.mock.calls.at(1);
    const thirdCall = query.mock.calls.at(2);
    const fourthCall = query.mock.calls.at(3);
    const fifthCall = query.mock.calls.at(4);
    const sixthCall = query.mock.calls.at(5);

    if (!firstCall || !secondCall || !thirdCall || !fourthCall || !fifthCall || !sixthCall) {
      throw new Error("expected query calls are missing");
    }

    const firstSql = firstCall[0] as string;
    const secondSql = secondCall[0] as string;
    const thirdSql = thirdCall[0] as string;
    const fourthSql = fourthCall[0] as string;
    const fifthSql = fifthCall[0] as string;
    const sixthSql = sixthCall[0] as string;

    expect(firstSql).toContain("001_init_notes.sql");
    expect(secondSql).toContain("002_indexes.sql");
    expect(thirdSql).toContain("003_note_pages.sql");
    expect(fourthSql).toContain("004_note_strokes.sql");
    expect(fifthSql).toContain("005_conflict_payload_hash.sql");
    expect(sixthSql).toContain("006_conflict_payload_summary.sql");
    expect(result.appliedFiles).toEqual([
      "001_init_notes.sql",
      "002_indexes.sql",
      "003_note_pages.sql",
      "004_note_strokes.sql",
      "005_conflict_payload_hash.sql",
      "006_conflict_payload_summary.sql"
    ]);
  });
});
