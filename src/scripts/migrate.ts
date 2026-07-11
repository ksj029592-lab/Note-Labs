import { readFile as fsReadFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

type FsOps = {
  readDir(dir: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
};

type PgClient = {
  connect(): Promise<unknown>;
  query(sql: string): Promise<void>;
  end(): Promise<void>;
};

type RunMigrationsInput = {
  databaseUrl: string;
  migrationsDir: string;
  createClient?: (databaseUrl: string) => PgClient;
  fsOps?: FsOps;
};

type RunMigrationsResult = {
  appliedFiles: string[];
};

const defaultFsOps: FsOps = {
  readDir: (dir) => readdir(dir),
  readFile: (path) => fsReadFile(path, "utf8")
};

function defaultCreateClient(databaseUrl: string): PgClient {
  return new Client({ connectionString: databaseUrl });
}

export async function runMigrations(input: RunMigrationsInput): Promise<RunMigrationsResult> {
  const fsOps = input.fsOps ?? defaultFsOps;
  const createClient = input.createClient ?? defaultCreateClient;

  const fileNames = await fsOps.readDir(input.migrationsDir);
  const sqlFiles = fileNames.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b));

  const client = createClient(input.databaseUrl);
  await client.connect();

  try {
    for (const fileName of sqlFiles) {
      const fullPath = join(input.migrationsDir, fileName);
      const sql = await fsOps.readFile(fullPath);
      await client.query(sql);
    }
  } finally {
    await client.end();
  }

  return {
    appliedFiles: sqlFiles
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const result = await runMigrations({
    databaseUrl,
    migrationsDir: "db/migrations"
  });

  // eslint-disable-next-line no-console
  console.log(`Applied migrations: ${result.appliedFiles.join(", ")}`);
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
