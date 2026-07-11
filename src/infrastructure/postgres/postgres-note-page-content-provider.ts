import type {
  NotePageContent,
  NotePageContentRepositoryPort
} from "../../application/note-page-content.port";

type QueryResultRow = Record<string, unknown>;

type QueryResult = {
  rows: QueryResultRow[];
  rowCount: number | null;
};

type Queryable = {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
};

type NotePageRow = {
  page_index: number;
  content_text: string;
};

export class PostgresNotePageContentProvider implements NotePageContentRepositoryPort {
  constructor(private readonly db: Queryable) {}

  async replacePageContents(noteId: string, pages: NotePageContent[]): Promise<void> {
    await this.db.query(
      `delete from note_pages
       where note_id = $1`,
      [noteId]
    );

    for (const page of pages) {
      await this.db.query(
        `insert into note_pages (id, note_id, page_index, content_text, version)
         values ($1, $2, $3, $4, $5)`,
        [`${noteId}:${page.pageIndex}`, noteId, page.pageIndex, page.text, 1]
      );
    }
  }

  async listPageContentsByNoteId(noteId: string): Promise<NotePageContent[]> {
    const result = await this.db.query(
      `select page_index, content_text
       from note_pages
       where note_id = $1
       order by page_index asc`,
      [noteId]
    );

    return result.rows.map((row) => {
      const typed = row as NotePageRow;
      return {
        pageIndex: typed.page_index,
        text: typed.content_text
      };
    });
  }
}
