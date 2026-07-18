import { Pool } from "pg";
import type { AuthSession, UserSessionRepository } from "../../application/auth.types";

export class PostgresUserSessionRepository implements UserSessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(session: AuthSession): Promise<void> {
    await this.pool.query(
      `insert into user_sessions (token, user_id, created_at, expires_at, revoked_at)
       values ($1, $2, $3, $4, $5)`,
      [session.token, session.userId, session.createdAt, session.expiresAt, session.revokedAt]
    );
  }

  async findValidByToken(token: string, now: Date): Promise<AuthSession | null> {
    const result = await this.pool.query(
      `select token, user_id, created_at, expires_at, revoked_at
       from user_sessions
       where token = $1 and revoked_at is null and expires_at > $2
       limit 1`,
      [token, now]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      token: row.token,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at
    };
  }

  async revoke(token: string): Promise<void> {
    await this.pool.query(
      `update user_sessions
       set revoked_at = now()
       where token = $1 and revoked_at is null`,
      [token]
    );
  }
}
