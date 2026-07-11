import { InMemoryNoteRepository } from "../application/notes.repository.in-memory";
import type { NoteRepository } from "../application/notes.repository";
import { PostgresNoteRepository } from "../infrastructure/postgres/postgres-note-repository";
import { Pool } from "pg";

type Env = Record<string, string | undefined>;

type MakeInMemoryRepository = () => NoteRepository;
type MakePostgresRepository = (databaseUrl: string) => NoteRepository;

function defaultMakeInMemory(): NoteRepository {
  return new InMemoryNoteRepository();
}

function defaultMakePostgres(databaseUrl: string): NoteRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  return new PostgresNoteRepository(pool);
}

export function createNoteRepositoryFromEnv(
  env: Env,
  makeInMemory: MakeInMemoryRepository = defaultMakeInMemory,
  makePostgres: MakePostgresRepository = defaultMakePostgres
): NoteRepository {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    return makeInMemory();
  }

  return makePostgres(databaseUrl);
}
