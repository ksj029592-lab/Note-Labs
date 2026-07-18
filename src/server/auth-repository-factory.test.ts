import { describe, expect, it } from "vitest";
import { InMemoryUserAccountRepository, InMemoryUserSessionRepository } from "../application/auth.repository.in-memory";
import { createAuthRepositoriesFromEnv } from "./auth-repository-factory";

describe("createAuthRepositoriesFromEnv", () => {
  it("returns in-memory repositories when DATABASE_URL is missing", () => {
    const repositories = createAuthRepositoriesFromEnv({});

    expect(repositories.userAccounts).toBeInstanceOf(InMemoryUserAccountRepository);
    expect(repositories.userSessions).toBeInstanceOf(InMemoryUserSessionRepository);
  });
});
