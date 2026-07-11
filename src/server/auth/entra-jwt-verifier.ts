import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTVerifyOptions
} from "jose";
import type { VerifiedToken } from "./entra-auth";

type EntraJwtVerifierConfig = {
  issuer: string;
  audience: string;
  jwksUri?: string;
  getKey?: JWTVerifyGetKey;
};

function resolveKeyProvider(config: EntraJwtVerifierConfig): JWTVerifyGetKey {
  if (config.getKey) {
    return config.getKey;
  }

  if (!config.jwksUri) {
    throw new Error("jwksUri is required when getKey is not provided");
  }

  return createRemoteJWKSet(new URL(config.jwksUri));
}

export function createEntraJwtVerifier(config: EntraJwtVerifierConfig) {
  const getKey = resolveKeyProvider(config);
  const verifyOptions: JWTVerifyOptions = {
    issuer: config.issuer,
    audience: config.audience
  };

  return async (accessToken: string): Promise<VerifiedToken> => {
    const { payload } = await jwtVerify(accessToken, getKey, verifyOptions);

    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new Error("subject claim is missing");
    }

    return {
      sub: payload.sub
    };
  };
}
