import { Pool } from "pg";
import type { StrokeRepositoryPort } from "../application/stroke.port";
import { PostgresStrokeRepository } from "../infrastructure/postgres/postgres-stroke-repository";

type Env = Record<string, string | undefined>;

type MakePostgresStrokeRepository = (databaseUrl: string) => StrokeRepositoryPort;

function defaultMakePostgresStrokeRepository(databaseUrl: string): StrokeRepositoryPort {
  const pool = new Pool({ connectionString: databaseUrl });
  return new PostgresStrokeRepository(pool);
}

export function createStrokeProviderFromEnv(
  env: Env,
  makePostgresStrokeRepository: MakePostgresStrokeRepository = defaultMakePostgresStrokeRepository
): StrokeRepositoryPort | undefined {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  return makePostgresStrokeRepository(databaseUrl);
}
