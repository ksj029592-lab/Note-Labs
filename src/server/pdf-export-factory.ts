import type { NoteRepository } from "../application/notes.repository";
import { PdfExportService } from "../application/pdf-export.service";
import type { NotePageContentProviderPort } from "../application/note-page-content.port";
import type { StrokeProviderPort } from "../application/stroke.port";
import { AzureBlobPdfStorage } from "../infrastructure/azure/blob-pdf-storage";
import { createBlobServiceClientFromEnv } from "../infrastructure/azure/blob-client-factory";

type Env = Record<string, string | undefined>;

type CreateBlobServiceClient = (
  env: Env
) => {
  getContainerClient(containerName: string): {
    getBlockBlobClient(blobName: string): {
      uploadData(
        data: Buffer,
        options?: { blobHTTPHeaders?: { blobContentType?: string } }
      ): Promise<unknown>;
      url: string;
    };
  };
};

type PdfExportDependencies = {
  pageContentProvider?: NotePageContentProviderPort;
  strokeProvider?: StrokeProviderPort;
};

export function createPdfExportServiceFromEnv(
  env: Env,
  noteRepository: NoteRepository,
  createBlobServiceClient?: CreateBlobServiceClient,
  dependencies: PdfExportDependencies = {}
): PdfExportService | undefined {
  const containerName = env.AZURE_BLOB_PDF_CONTAINER;

  if (!containerName) {
    return undefined;
  }

  const createClient = createBlobServiceClient ?? createBlobServiceClientFromEnv;
  const blobServiceClient = createClient(env);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const storage = new AzureBlobPdfStorage(containerClient);

  return new PdfExportService(noteRepository, storage, dependencies);
}
