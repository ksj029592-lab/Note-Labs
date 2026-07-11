import { describe, expect, it, vi } from "vitest";
import { PostgresStrokeRepository } from "./postgres-stroke-repository";

describe("PostgresStrokeRepository", () => {
  it("replaces strokes with delete then insert", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 1 }));
    const repository = new PostgresStrokeRepository({ query });

    await repository.replaceByNoteId("note-1", [
      {
        pageIndex: 0,
        toolType: "pen",
        color: "#111111",
        width: 2,
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 }
        ]
      }
    ]);

    expect(query).toHaveBeenCalledTimes(2);
    const firstSql = query.mock.calls[0]?.[0] as string;
    const secondSql = query.mock.calls[1]?.[0] as string;
    expect(firstSql).toContain("delete from note_strokes");
    expect(secondSql).toContain("insert into note_strokes");
  });

  it("maps persisted rows to note strokes", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          page_index: 1,
          tool_type: "highlighter",
          color: "#abcdef",
          width: 5,
          points_json: [
            { x: 10, y: 20 },
            { x: 30, y: 40 }
          ]
        }
      ]
    }));

    const repository = new PostgresStrokeRepository({ query });
    const strokes = await repository.listByNoteId("note-1");

    expect(strokes).toEqual([
      {
        pageIndex: 1,
        toolType: "highlighter",
        color: "#abcdef",
        width: 5,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 }
        ]
      }
    ]);
  });
});
