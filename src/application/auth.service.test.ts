import { describe, expect, it } from "vitest";
import {
  InMemoryUserAccountRepository,
  InMemoryUserSessionRepository
} from "./auth.repository.in-memory";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("signs up and logs in with username/password", async () => {
    const users = new InMemoryUserAccountRepository();
    const sessions = new InMemoryUserSessionRepository();
    const auth = new AuthService(users, sessions);

    const signedUp = await auth.signup({ username: "demo-user", password: "Password!123" });
    expect(signedUp.user.username).toBe("demo-user");
    expect(signedUp.token.length).toBeGreaterThan(10);

    const loggedIn = await auth.login({ username: "demo-user", password: "Password!123" });
    expect(loggedIn.user.id).toBe(signedUp.user.id);
    expect(loggedIn.token).not.toBe(signedUp.token);
  });

  it("fails login with wrong password", async () => {
    const users = new InMemoryUserAccountRepository();
    const sessions = new InMemoryUserSessionRepository();
    const auth = new AuthService(users, sessions);

    await auth.signup({ username: "demo-user", password: "Password!123" });

    await expect(auth.login({ username: "demo-user", password: "bad" })).rejects.toThrow(
      "invalid credentials"
    );
  });

  it("verifies and revokes token", async () => {
    const users = new InMemoryUserAccountRepository();
    const sessions = new InMemoryUserSessionRepository();
    const auth = new AuthService(users, sessions);

    const signup = await auth.signup({ username: "demo-user", password: "Password!123" });

    const verified = await auth.verifyToken(signup.token);
    expect(verified.username).toBe("demo-user");

    await auth.logout(signup.token);
    await expect(auth.verifyToken(signup.token)).rejects.toThrow("invalid access token");
  });

  it("rejects weak password", async () => {
    const users = new InMemoryUserAccountRepository();
    const sessions = new InMemoryUserSessionRepository();
    const auth = new AuthService(users, sessions);

    await expect(auth.signup({ username: "demo-user", password: "password123" })).rejects.toThrow(
      "password must include upper or special characters"
    );

    await expect(auth.signup({ username: "demo-user", password: "Password!!" })).rejects.toThrow(
      "password must include lower and number characters"
    );

    await expect(auth.signup({ username: "demo-user", password: "Pas!12" })).rejects.toThrow(
      "password must be at least 8 characters"
    );
  });
});
