import { Pool } from "pg";
import type { AuthUser, UserAccountRepository } from "../../application/auth.types";

export class PostgresUserAccountRepository implements UserAccountRepository {
  constructor(private readonly pool: Pool) {}

  async create(user: AuthUser): Promise<void> {
    await this.pool.query(
      `insert into users (id, username, username_lower, password_hash, created_at)
       values ($1, $2, $3, $4, $5)`,
      [user.id, user.username, user.username.toLowerCase(), user.passwordHash, user.createdAt]
    );
  }

  async findByUsername(username: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `select id, username, password_hash, created_at
       from users
       where username_lower = $1
       limit 1`,
      [username.toLowerCase()]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      createdAt: row.created_at
    };
  }

  async findById(userId: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `select id, username, password_hash, created_at
       from users
       where id = $1
       limit 1`,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      createdAt: row.created_at
    };
  }
}
