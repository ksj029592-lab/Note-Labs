import { describe, expect, it } from "vitest";
import { resolveBlobClientConfig } from "./blob-client-factory";

describe("resolveBlobClientConfig", () => {
  it("uses connection string when provided", () => {
    const config = resolveBlobClientConfig({
      AZURE_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true"
    });

    expect(config.mode).toBe("connection-string");
  });

  it("uses managed identity mode when account url exists", () => {
    const config = resolveBlobClientConfig({
      AZURE_STORAGE_ACCOUNT_URL: "https://mystorage.blob.core.windows.net"
    });

    expect(config.mode).toBe("managed-identity");
  });

  it("throws when required env is missing", () => {
    expect(() => resolveBlobClientConfig({})).toThrowError(
      "AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_URL is required"
    );
  });
});
