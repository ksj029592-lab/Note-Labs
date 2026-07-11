import { describe, expect, it, vi } from "vitest";
import { PostgresNotePageContentProvider } from "./postgres-note-page-content-provider";

describe("PostgresNotePageContentProvider", () => {
  it("replaces note pages with delete then insert", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: []
    }));

    const provider = new PostgresNotePageContentProvider({ query });

    await provider.replacePageContents("note-1", [
      { pageIndex: 0, text: "first" },
      { pageIndex: 1, text: "second" }
    ]);

    expect(query).toHaveBeenCalledTimes(3);
    const firstSql = query.mock.calls[0]?.[0] as string;
    expect(firstSql).toContain("delete from note_pages");
    const secondSql = query.mock.calls[1]?.[0] as string;
    expect(secondSql).toContain("insert into note_pages");
  });

  it("queries and maps page contents by note id", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 2,
      rows: [
        { page_index: 0, content_text: "first page" },
        { page_index: 1, content_text: "second page" }
      ]
    }));

    const provider = new PostgresNotePageContentProvider({ query });
    const pages = await provider.listPageContentsByNoteId("note-1");

    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0]?.[0] as string;
    const params = query.mock.calls[0]?.[1] as unknown[];
    expect(sql).toContain("from note_pages");
    expect(params).toEqual(["note-1"]);
    expect(pages).toEqual([
      { pageIndex: 0, text: "first page" },
      { pageIndex: 1, text: "second page" }
    ]);
  });
});
