import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthSession, AuthUser, UserAccountRepository, UserSessionRepository } from "./auth.types";

type SignupInput = {
  username: string;
  password: string;
};

type LoginInput = {
  username: string;
  password: string;
};

type AuthResult = {
  token: string;
  user: {
    id: string;
    username: string;
  };
};

export class AuthService {
  constructor(
    private readonly users: UserAccountRepository,
    private readonly sessions: UserSessionRepository
  ) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    const username = this.normalizeUsername(input.username);
    this.validatePassword(input.password, username);

    const existing = await this.users.findByUsername(username);
    if (existing) {
      throw new Error("username already exists");
    }

    const userId = `user-${createHash("sha1").update(`${username}-${Date.now()}`).digest("hex").slice(0, 12)}`;
    const passwordHash = this.hashPassword(input.password);

    const user: AuthUser = {
      id: userId,
      username,
      passwordHash,
      createdAt: new Date()
    };

    await this.users.create(user);
    const session = await this.createSession(user.id);

    return {
      token: session.token,
      user: { id: user.id, username: user.username }
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const username = this.normalizeUsername(input.username);
    const user = await this.users.findByUsername(username);

    if (!user || !this.verifyPassword(input.password, user.passwordHash)) {
      throw new Error("invalid credentials");
    }

    const session = await this.createSession(user.id);
    return {
      token: session.token,
      user: { id: user.id, username: user.username }
    };
  }

  async verifyToken(token: string): Promise<{ userId: string; username: string }> {
    const session = await this.sessions.findValidByToken(token, new Date());
    if (!session) {
      throw new Error("invalid access token");
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new Error("invalid access token");
    }

    return { userId: user.id, username: user.username };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
  }

  private async createSession(userId: string): Promise<AuthSession> {
    const token = randomBytes(32).toString("base64url");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * 30);

    const session: AuthSession = {
      token,
      userId,
      createdAt,
      expiresAt,
      revokedAt: null
    };

    await this.sessions.create(session);
    return session;
  }

  private normalizeUsername(username: string): string {
    const normalized = username.trim().toLowerCase();
    if (!normalized) {
      throw new Error("username is required");
    }

    if (!/^[a-z0-9._-]{3,32}$/.test(normalized)) {
      throw new Error("username must be 3-32 chars and contain only a-z, 0-9, ., _, -");
    }

    return normalized;
  }

  private validatePassword(password: string, username: string): void {
    if (password.length < 8) {
      throw new Error("password must be at least 8 characters");
    }

    if (password.length > 128) {
      throw new Error("password must be 128 characters or less");
    }

    if (/\s/.test(password)) {
      throw new Error("password must not contain spaces");
    }

    if (!/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error("password must include lower and number characters");
    }

    if (!(/[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password))) {
      throw new Error("password must include upper or special characters");
    }

    if (password.toLowerCase().includes(username.toLowerCase())) {
      throw new Error("password must not include username");
    }
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, passwordHash: string): boolean {
    const [salt, expectedHex] = passwordHash.split(":");
    if (!salt || !expectedHex) {
      return false;
    }

    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, 64);

    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  }
}
