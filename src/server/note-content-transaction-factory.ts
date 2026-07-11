import { Pool } from "pg";
import type { NoteContentTransactionalWriterPort } from "../application/note-content-transaction.port";
import { PostgresNoteContentTransactionalWriter } from "../infrastructure/postgres/postgres-note-content-transactional-writer";

type Env = Record<string, string | undefined>;

type MakePostgresNoteContentTransactionalWriter = (
  databaseUrl: string
) => NoteContentTransactionalWriterPort;

function defaultMakePostgresNoteContentTransactionalWriter(
  databaseUrl: string
): NoteContentTransactionalWriterPort {
  const pool = new Pool({ connectionString: databaseUrl });
  return new PostgresNoteContentTransactionalWriter(pool);
}

export function createNoteContentTransactionalWriterFromEnv(
  env: Env,
  makeWriter: MakePostgresNoteContentTransactionalWriter = defaultMakePostgresNoteContentTransactionalWriter
): NoteContentTransactionalWriterPort | undefined {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  return makeWriter(databaseUrl);
}
