import { NextFunction, Request, Response } from "express";
import { AuthService } from "../../application/auth.service";

export function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function createRequireLocalAuth(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readBearerToken(req.header("Authorization"));

    if (!token) {
      res.status(401).json({ message: "missing bearer token" });
      return;
    }

    try {
      const verified = await authService.verifyToken(token);
      res.locals.userId = verified.userId;
      res.locals.username = verified.username;
      next();
    } catch {
      res.status(401).json({ message: "invalid access token" });
    }
  };
}
