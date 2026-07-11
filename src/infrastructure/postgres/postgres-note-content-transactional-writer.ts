import type {
  NoteContentTransactionalWriterPort,
  ReplaceNoteContentAtomicallyInput,
  ReplaceNoteContentAtomicallyResult
} from "../../application/note-content-transaction.port";

type QueryResultRow = Record<string, unknown>;

type QueryResult = {
  rows: QueryResultRow[];
  rowCount: number | null;
};

type Queryable = {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
};

type VersionRow = {
  version: number;
};

export class PostgresNoteContentTransactionalWriter
  implements NoteContentTransactionalWriterPort
{
  constructor(private readonly db: Queryable) {}

  async replaceNoteContentAtomically(
    input: ReplaceNoteContentAtomicallyInput
  ): Promise<ReplaceNoteContentAtomicallyResult> {
    await this.db.query("begin");

    try {
      const versionResult = await this.db.query(
        `select version
         from notes
         where id = $1
         for update`,
        [input.noteId]
      );

      if (!versionResult.rowCount || versionResult.rowCount === 0) {
        throw new Error("note not found");
      }

      const currentVersion = (versionResult.rows[0] as VersionRow).version;

      if (currentVersion !== input.expectedVersion) {
        await this.db.query("rollback");
        return {
          status: "conflict",
          actualVersion: currentVersion
        };
      }

      await this.db.query(
        `delete from note_pages
         where note_id = $1`,
        [input.noteId]
      );

      for (const page of input.pages) {
        await this.db.query(
          `insert into note_pages (id, note_id, page_index, content_text, version)
           values ($1, $2, $3, $4, $5)`,
          [`${input.noteId}:${page.pageIndex}`, input.noteId, page.pageIndex, page.text, 1]
        );
      }

      await this.db.query(
        `delete from note_strokes
         where note_id = $1`,
        [input.noteId]
      );

      for (let index = 0; index < input.strokes.length; index += 1) {
        const stroke = input.strokes[index];
        await this.db.query(
          `insert into note_strokes (
            id,
            note_id,
            page_index,
            tool_type,
            color,
            width,
            points_json,
            created_at,
            updated_at
          ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())`,
          [
            `${input.noteId}:stroke:${index}`,
            input.noteId,
            stroke.pageIndex ?? null,
            stroke.toolType,
            stroke.color,
            stroke.width,
            JSON.stringify(stroke.points)
          ]
        );
      }

      const nextVersion = currentVersion + 1;
      await this.db.query(
        `update notes
         set version = $2
         where id = $1`,
        [input.noteId, nextVersion]
      );

      await this.db.query("commit");
      return {
        status: "updated",
        noteVersion: nextVersion
      };
    } catch (error) {
      try {
        await this.db.query("rollback");
      } catch {
        // noop
      }
      throw error;
    }
  }
}
