import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { InMemoryNoteRepository } from "../application/notes.repository.in-memory";
import { Note } from "../domain/note";
import { createPdfExportServiceFromEnv } from "./pdf-export-factory";

describe("createPdfExportServiceFromEnv", () => {
  it("returns undefined when required blob env is missing", () => {
    const repo = new InMemoryNoteRepository();
    const createBlobServiceClient = vi.fn();

    const service = createPdfExportServiceFromEnv({}, repo, createBlobServiceClient);

    expect(service).toBeUndefined();
    expect(createBlobServiceClient).not.toHaveBeenCalled();
  });

  it("creates PdfExportService when container env exists", async () => {
    const repo = new InMemoryNoteRepository();
    const uploadData = vi.fn(async () => undefined);

    const createBlobServiceClient = vi.fn(() => ({
      getContainerClient: () => ({
        getBlockBlobClient: () => ({
          uploadData,
          url: "https://storage.example/container/note-1/1700000000000.pdf"
        })
      })
    }));

    const service = createPdfExportServiceFromEnv(
      {
        AZURE_STORAGE_ACCOUNT_URL: "https://mystorage.blob.core.windows.net",
        AZURE_BLOB_PDF_CONTAINER: "note-exports"
      },
      repo,
      createBlobServiceClient
    );

    expect(service).toBeDefined();
    expect(createBlobServiceClient).toHaveBeenCalledTimes(1);

    await repo.save(
      Note.create({
        id: "note-1",
        userId: "user-1",
        title: "Factory Export"
      })
    );

    const result = await service!.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });
    expect(result.url).toContain("storage.example");
    expect(uploadData).toHaveBeenCalledTimes(1);
  });

  it("wires page and stroke providers into export service", async () => {
    const repo = new InMemoryNoteRepository();

    await repo.save(
      Note.create({
        id: "note-1",
        userId: "user-1",
        title: "Factory Export With Providers"
      })
    );

    let uploaded: Buffer | undefined;
    const uploadData = vi.fn(async (data: Buffer) => {
      uploaded = data;
      return undefined;
    });

    const createBlobServiceClient = vi.fn(() => ({
      getContainerClient: () => ({
        getBlockBlobClient: () => ({
          uploadData,
          url: "https://storage.example/container/note-1/providers.pdf"
        })
      })
    }));

    const listPageContentsByNoteId = vi.fn(async () => [
      { pageIndex: 0, text: "Page 1" },
      { pageIndex: 1, text: "Page 2" }
    ]);

    const listByNoteId = vi.fn(async () => [
      {
        pageIndex: 1,
        toolType: "pen" as const,
        color: "#111111",
        width: 2,
        points: [
          { x: 10, y: 10 },
          { x: 100, y: 100 }
        ]
      }
    ]);

    const service = createPdfExportServiceFromEnv(
      {
        AZURE_STORAGE_ACCOUNT_URL: "https://mystorage.blob.core.windows.net",
        AZURE_BLOB_PDF_CONTAINER: "note-exports"
      },
      repo,
      createBlobServiceClient,
      {
        pageContentProvider: { listPageContentsByNoteId },
        strokeProvider: { listByNoteId }
      }
    );

    await service!.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });

    expect(listPageContentsByNoteId).toHaveBeenCalledWith("note-1");
    expect(listByNoteId).toHaveBeenCalledWith("note-1");

    if (!uploaded) {
      throw new Error("uploaded bytes are missing");
    }

    const parsed = await PDFDocument.load(uploaded);
    expect(parsed.getPageCount()).toBe(2);
  });
});
