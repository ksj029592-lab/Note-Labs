import { NextFunction, Request, Response } from "express";

export type VerifiedToken = {
  sub: string;
};

export type VerifyEntraAccessToken = (token: string) => Promise<VerifiedToken>;

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function createRequireEntraAuth(verifyToken: VerifyEntraAccessToken) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readBearerToken(req.header("Authorization"));

    if (!token) {
      res.status(401).json({ message: "missing bearer token" });
      return;
    }

    try {
      const verified = await verifyToken(token);
      res.locals.userId = verified.sub;
      next();
    } catch {
      res.status(401).json({ message: "invalid access token" });
    }
  };
}
