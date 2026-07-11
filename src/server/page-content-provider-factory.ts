import { Pool } from "pg";
import type { NotePageContentRepositoryPort } from "../application/note-page-content.port";
import { PostgresNotePageContentProvider } from "../infrastructure/postgres/postgres-note-page-content-provider";

type Env = Record<string, string | undefined>;

type MakePostgresPageContentProvider = (databaseUrl: string) => NotePageContentRepositoryPort;

function defaultMakePostgresPageContentProvider(databaseUrl: string): NotePageContentRepositoryPort {
  const pool = new Pool({ connectionString: databaseUrl });
  return new PostgresNotePageContentProvider(pool);
}

export function createPageContentProviderFromEnv(
  env: Env,
  makePostgresProvider: MakePostgresPageContentProvider = defaultMakePostgresPageContentProvider
): NotePageContentRepositoryPort | undefined {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  return makePostgresProvider(databaseUrl);
}
