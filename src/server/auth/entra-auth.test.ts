import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRequireEntraAuth } from "./entra-auth";

describe("createRequireEntraAuth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = express();
    const middleware = createRequireEntraAuth(async () => ({ sub: "user-1" }));

    app.get("/protected", middleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).get("/protected");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("missing bearer token");
  });

  it("returns 401 when token verification fails", async () => {
    const app = express();
    const middleware = createRequireEntraAuth(async () => {
      throw new Error("invalid token");
    });

    app.get("/protected", middleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer bad-token");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("invalid access token");
  });

  it("passes and stores userId when token is valid", async () => {
    const app = express();
    const middleware = createRequireEntraAuth(async () => ({ sub: "entra-user-1" }));

    app.get("/protected", middleware, (_req, res) => {
      res.status(200).json({ userId: res.locals.userId });
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("entra-user-1");
  });
});
