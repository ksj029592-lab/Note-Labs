import { Pool } from "pg";
import {
  InMemoryUserAccountRepository,
  InMemoryUserSessionRepository
} from "../application/auth.repository.in-memory";
import type { UserAccountRepository, UserSessionRepository } from "../application/auth.types";
import { PostgresUserAccountRepository } from "../infrastructure/postgres/postgres-user-account-repository";
import { PostgresUserSessionRepository } from "../infrastructure/postgres/postgres-user-session-repository";

type Env = Record<string, string | undefined>;

export function createAuthRepositoriesFromEnv(env: Env): {
  userAccounts: UserAccountRepository;
  userSessions: UserSessionRepository;
} {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      userAccounts: new InMemoryUserAccountRepository(),
      userSessions: new InMemoryUserSessionRepository()
    };
  }

  const pool = new Pool({ connectionString: databaseUrl });
  return {
    userAccounts: new PostgresUserAccountRepository(pool),
    userSessions: new PostgresUserSessionRepository(pool)
  };
}
