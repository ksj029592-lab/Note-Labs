import { AuthService } from "../application/auth.service";
import { NoteContentService } from "../application/note-content.service";
import { InMemoryNotePageContentRepository } from "../application/note-page-content.repository.in-memory";
import { NotePageContentService } from "../application/note-page-content.service";
import { NotesService } from "../application/notes.service";
import { StrokeService } from "../application/stroke.service";
import { createApp } from "./app";
import { buildAppOptionsFromEnv } from "./runtime-options";
import { createNoteRepositoryFromEnv } from "./repository-factory";
import { createPdfExportServiceFromEnv } from "./pdf-export-factory";
import { createPageContentProviderFromEnv } from "./page-content-provider-factory";
import { createStrokeProviderFromEnv } from "./stroke-provider-factory";
import { InMemoryStrokeRepository } from "../application/stroke.repository.in-memory";
import { createNoteContentTransactionalWriterFromEnv } from "./note-content-transaction-factory";
import { createAuthRepositoriesFromEnv } from "./auth-repository-factory";

const repo = createNoteRepositoryFromEnv(process.env);
const service = new NotesService(repo);
const appOptions = buildAppOptionsFromEnv(process.env);
const pageContentProvider =
  createPageContentProviderFromEnv(process.env) ?? new InMemoryNotePageContentRepository();
const strokeProvider = createStrokeProviderFromEnv(process.env) ?? new InMemoryStrokeRepository();
const noteContentTransactionalWriter = createNoteContentTransactionalWriterFromEnv(process.env);
const notePageContentService = new NotePageContentService(repo, pageContentProvider);
const strokeService = new StrokeService(repo, strokeProvider);
const authRepositories = createAuthRepositoriesFromEnv(process.env);
const authService = new AuthService(authRepositories.userAccounts, authRepositories.userSessions);
const noteContentService = new NoteContentService(
  repo,
  pageContentProvider,
  strokeProvider,
  noteContentTransactionalWriter
);
const pdfExportService = createPdfExportServiceFromEnv(process.env, repo, undefined, {
  pageContentProvider,
  strokeProvider
});
const app = createApp(service, {
  ...appOptions,
  pdfExportService,
  notePageContentService,
  strokeService,
  noteContentService,
  authService
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
