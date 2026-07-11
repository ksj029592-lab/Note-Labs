import type { AppOptions } from "./app";
import type { VerifyEntraAccessToken } from "./auth/entra-auth";
import { createEntraJwtVerifier } from "./auth/entra-jwt-verifier";

type Env = Record<string, string | undefined>;

type CreateVerifier = (config: {
  issuer: string;
  audience: string;
  jwksUri?: string;
}) => VerifyEntraAccessToken;

function mustGet(env: Env, key: string, errorMessage: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
}

export function buildAppOptionsFromEnv(
  env: Env,
  createVerifier: CreateVerifier = createEntraJwtVerifier
): AppOptions {
  const authRequired = env.ENTRA_AUTH_REQUIRED === "true";

  if (!authRequired) {
    return { requireAuth: false };
  }

  const issuer = mustGet(env, "ENTRA_ISSUER", "ENTRA_ISSUER is required when ENTRA_AUTH_REQUIRED=true");
  const audience = mustGet(
    env,
    "ENTRA_AUDIENCE",
    "ENTRA_AUDIENCE is required when ENTRA_AUTH_REQUIRED=true"
  );
  const jwksUri = env.ENTRA_JWKS_URI;

  return {
    requireAuth: true,
    verifyToken: createVerifier({ issuer, audience, jwksUri })
  };
}
