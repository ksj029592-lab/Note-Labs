import { describe, expect, it, vi } from "vitest";
import type { VerifyEntraAccessToken } from "./auth/entra-auth";
import { buildAppOptionsFromEnv } from "./runtime-options";

describe("buildAppOptionsFromEnv", () => {
  it("returns auth disabled options by default", () => {
    const createVerifier = vi.fn();

    const options = buildAppOptionsFromEnv({}, createVerifier);

    expect(options.requireAuth).toBe(false);
    expect(options.verifyToken).toBeUndefined();
    expect(createVerifier).not.toHaveBeenCalled();
  });

  it("enables auth and creates verifier when required env is present", () => {
    const verifier: VerifyEntraAccessToken = async () => ({ sub: "user-1" });
    const createVerifier = vi.fn(() => verifier);

    const options = buildAppOptionsFromEnv(
      {
        ENTRA_AUTH_REQUIRED: "true",
        ENTRA_ISSUER: "https://login.microsoftonline.com/tenant/v2.0",
        ENTRA_AUDIENCE: "api://notes-app",
        ENTRA_JWKS_URI: "https://login.microsoftonline.com/tenant/discovery/v2.0/keys"
      },
      createVerifier
    );

    expect(options.requireAuth).toBe(true);
    expect(options.verifyToken).toBe(verifier);
    expect(createVerifier).toHaveBeenCalledWith({
      issuer: "https://login.microsoftonline.com/tenant/v2.0",
      audience: "api://notes-app",
      jwksUri: "https://login.microsoftonline.com/tenant/discovery/v2.0/keys"
    });
  });

  it("throws when auth is required but mandatory env is missing", () => {
    const createVerifier = vi.fn();

    expect(() =>
      buildAppOptionsFromEnv(
        {
          ENTRA_AUTH_REQUIRED: "true",
          ENTRA_ISSUER: "https://login.microsoftonline.com/tenant/v2.0"
        },
        createVerifier
      )
    ).toThrowError("ENTRA_AUDIENCE is required when ENTRA_AUTH_REQUIRED=true");
  });
});
