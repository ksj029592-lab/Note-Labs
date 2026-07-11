import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createEntraJwtVerifier } from "./entra-jwt-verifier";

describe("createEntraJwtVerifier", () => {
  it("verifies token and returns sub", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-kid";

    const jwks = createLocalJWKSet({ keys: [jwk] });
    const verifier = createEntraJwtVerifier({
      issuer: "https://login.microsoftonline.com/test-tenant/v2.0",
      audience: "api://notes-app",
      getKey: jwks
    });

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer("https://login.microsoftonline.com/test-tenant/v2.0")
      .setAudience("api://notes-app")
      .setSubject("entra-user-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    const verified = await verifier(token);

    expect(verified.sub).toBe("entra-user-1");
  });

  it("throws when audience does not match", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-kid";

    const jwks = createLocalJWKSet({ keys: [jwk] });
    const verifier = createEntraJwtVerifier({
      issuer: "https://login.microsoftonline.com/test-tenant/v2.0",
      audience: "api://notes-app",
      getKey: jwks
    });

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer("https://login.microsoftonline.com/test-tenant/v2.0")
      .setAudience("api://another-app")
      .setSubject("entra-user-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(verifier(token)).rejects.toThrowError();
  });
});
