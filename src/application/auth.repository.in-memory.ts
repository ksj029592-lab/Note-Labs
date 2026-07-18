import type {
  AuthSession,
  AuthUser,
  UserAccountRepository,
  UserSessionRepository
} from "./auth.types";

export class InMemoryUserAccountRepository implements UserAccountRepository {
  private readonly users = new Map<string, AuthUser>();
  private readonly usersByUsername = new Map<string, AuthUser>();

  async create(user: AuthUser): Promise<void> {
    this.users.set(user.id, user);
    this.usersByUsername.set(user.username.toLowerCase(), user);
  }

  async findByUsername(username: string): Promise<AuthUser | null> {
    return this.usersByUsername.get(username.toLowerCase()) ?? null;
  }

  async findById(userId: string): Promise<AuthUser | null> {
    return this.users.get(userId) ?? null;
  }
}

export class InMemoryUserSessionRepository implements UserSessionRepository {
  private readonly sessions = new Map<string, AuthSession>();

  async create(session: AuthSession): Promise<void> {
    this.sessions.set(session.token, session);
  }

  async findValidByToken(token: string, now: Date): Promise<AuthSession | null> {
    const session = this.sessions.get(token) ?? null;
    if (!session) {
      return null;
    }

    if (session.revokedAt) {
      return null;
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    return session;
  }

  async revoke(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (!session) {
      return;
    }

    session.revokedAt = new Date();
    this.sessions.set(token, session);
  }
}
