export type AuthUser = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
};

export type AuthSession = {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface UserAccountRepository {
  create(user: AuthUser): Promise<void>;
  findByUsername(username: string): Promise<AuthUser | null>;
  findById(userId: string): Promise<AuthUser | null>;
}

export interface UserSessionRepository {
  create(session: AuthSession): Promise<void>;
  findValidByToken(token: string, now: Date): Promise<AuthSession | null>;
  revoke(token: string): Promise<void>;
}
