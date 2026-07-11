import { describe, expect, it, vi } from "vitest";
import { AzureBlobPdfStorage } from "./blob-pdf-storage";

describe("AzureBlobPdfStorage", () => {
  it("uploads pdf bytes with application/pdf content type", async () => {
    const uploadData = vi.fn(async () => undefined);

    const storage = new AzureBlobPdfStorage(
      {
        getBlockBlobClient: () => ({
          uploadData,
          url: "https://storage.example/container/note-1/1700000000000.pdf"
        })
      },
      () => 1700000000000
    );

    const result = await storage.savePdf({
      noteId: "note-1",
      bytes: Buffer.from("%PDF-1.7")
    });

    expect(result.blobName).toBe("note-1/1700000000000.pdf");
    expect(result.url).toBe("https://storage.example/container/note-1/1700000000000.pdf");
    expect(uploadData).toHaveBeenCalledWith(Buffer.from("%PDF-1.7"), {
      blobHTTPHeaders: {
        blobContentType: "application/pdf"
      }
    });
  });
});
