import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

type Env = Record<string, string | undefined>;

export type BlobClientConfig =
  | { mode: "connection-string"; connectionString: string }
  | { mode: "managed-identity"; accountUrl: string };

export function resolveBlobClientConfig(env: Env): BlobClientConfig {
  const connectionString = env.AZURE_STORAGE_CONNECTION_STRING;

  if (connectionString) {
    return {
      mode: "connection-string",
      connectionString
    };
  }

  const accountUrl = env.AZURE_STORAGE_ACCOUNT_URL;

  if (accountUrl) {
    return {
      mode: "managed-identity",
      accountUrl
    };
  }

  throw new Error("AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_URL is required");
}

export function createBlobServiceClientFromEnv(env: Env): BlobServiceClient {
  const config = resolveBlobClientConfig(env);

  if (config.mode === "connection-string") {
    return BlobServiceClient.fromConnectionString(config.connectionString);
  }

  return new BlobServiceClient(config.accountUrl, new DefaultAzureCredential());
}
