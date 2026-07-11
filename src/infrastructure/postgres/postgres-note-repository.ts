import { Note } from "../../domain/note";
import type { ConflictCopy, NoteRepository } from "../../application/notes.repository";

type QueryResultRow = Record<string, unknown>;

type QueryResult = {
  rows: QueryResultRow[];
  rowCount: number | null;
};

type Queryable = {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
};

type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  version: number;
  deleted_at: Date | null;
};

type ConflictCopyRow = {
  id: string;
  original_note_id: string;
  user_id: string;
  attempted_title: string;
  attempted_payload_hash: string | null;
  attempted_pages_count: number | null;
  attempted_strokes_count: number | null;
  expected_version: number;
  actual_version: number;
  created_at: Date;
};

function mapNoteRowToDomain(row: NoteRow): Note {
  return Note.rehydrate({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    version: row.version,
    deletedAt: row.deleted_at
  });
}

function mapConflictRowToDomain(row: ConflictCopyRow): ConflictCopy {
  return {
    id: row.id,
    originalNoteId: row.original_note_id,
    userId: row.user_id,
    attemptedTitle: row.attempted_title,
    attemptedPayloadHash: row.attempted_payload_hash ?? undefined,
    attemptedPagesCount: row.attempted_pages_count ?? undefined,
    attemptedStrokesCount: row.attempted_strokes_count ?? undefined,
    expectedVersion: row.expected_version,
    actualVersion: row.actual_version,
    createdAt: row.created_at
  };
}

export class PostgresNoteRepository implements NoteRepository {
  constructor(private readonly db: Queryable) {}

  async save(note: Note): Promise<void> {
    await this.db.query(
      `insert into notes (id, user_id, title, version, deleted_at)
       values ($1, $2, $3, $4, $5)
       on conflict (id)
       do update set
         title = excluded.title,
         version = excluded.version,
         deleted_at = excluded.deleted_at`,
      [note.id, note.userId, note.title, note.version, note.deletedAt]
    );
  }

  async findById(noteId: string): Promise<Note | null> {
    const result = await this.db.query(
      `select id, user_id, title, version, deleted_at
       from notes
       where id = $1`,
      [noteId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return null;
    }

    return mapNoteRowToDomain(result.rows[0] as NoteRow);
  }

  async listByUserId(userId: string): Promise<Note[]> {
    const result = await this.db.query(
      `select id, user_id, title, version, deleted_at
       from notes
       where user_id = $1 and deleted_at is null
       order by updated_at asc nulls last, created_at asc`,
      [userId]
    );

    return result.rows.map((row) => mapNoteRowToDomain(row as NoteRow));
  }

  async saveConflictCopy(conflictCopy: ConflictCopy): Promise<void> {
    await this.db.query(
      `insert into note_conflict_copies (
          id,
          original_note_id,
          user_id,
          attempted_title,
          attempted_payload_hash,
          attempted_pages_count,
          attempted_strokes_count,
          expected_version,
          actual_version,
          created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        conflictCopy.id,
        conflictCopy.originalNoteId,
        conflictCopy.userId,
        conflictCopy.attemptedTitle,
        conflictCopy.attemptedPayloadHash ?? null,
        conflictCopy.attemptedPagesCount ?? null,
        conflictCopy.attemptedStrokesCount ?? null,
        conflictCopy.expectedVersion,
        conflictCopy.actualVersion,
        conflictCopy.createdAt
      ]
    );
  }

  async listConflictCopiesByOriginalId(originalNoteId: string): Promise<ConflictCopy[]> {
    const result = await this.db.query(
      `select id, original_note_id, user_id, attempted_title, attempted_payload_hash, attempted_pages_count, attempted_strokes_count, expected_version, actual_version, created_at
       from note_conflict_copies
       where original_note_id = $1
       order by created_at asc`,
      [originalNoteId]
    );

    return result.rows.map((row) => mapConflictRowToDomain(row as ConflictCopyRow));
  }
}
