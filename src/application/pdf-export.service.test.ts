import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { InMemoryNoteRepository } from "./notes.repository.in-memory";
import { NotesService } from "./notes.service";
import { PdfExportService } from "./pdf-export.service";
import type { NotePageContent } from "./note-page-content.port";
import type { NoteStroke } from "./stroke.port";

describe("PdfExportService", () => {
  it("exports note as pdf and stores it", async () => {
    const repo = new InMemoryNoteRepository();
    const notesService = new NotesService(repo);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "First"
    });

    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async () => ({
      blobName: "note-1/1700000000000.pdf",
      url: "https://storage.example/note-1/1700000000000.pdf"
    }));

    const exportService = new PdfExportService(repo, { savePdf });

    const result = await exportService.exportNoteAsPdf({
      noteId: "note-1",
      userId: "user-1"
    });

    expect(result.url).toBe("https://storage.example/note-1/1700000000000.pdf");
    expect(savePdf).toHaveBeenCalledTimes(1);
    const firstCall = savePdf.mock.calls.at(0);
    if (!firstCall) {
      throw new Error("savePdf was not called");
    }

    const firstArg = firstCall[0] as { noteId: string; bytes: Buffer };
    expect(firstArg.noteId).toBe("note-1");
    expect(Buffer.isBuffer(firstArg.bytes)).toBe(true);
    expect(firstArg.bytes.length).toBeGreaterThan(0);

    const parsed = await PDFDocument.load(firstArg.bytes);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getTitle()).toBe("First");
  });

  it("throws when note does not exist", async () => {
    const repo = new InMemoryNoteRepository();
    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async () => ({ blobName: "x", url: "x" }));
    const exportService = new PdfExportService(repo, { savePdf });

    await expect(
      exportService.exportNoteAsPdf({
        noteId: "missing",
        userId: "user-1"
      })
    ).rejects.toThrowError("note not found");
  });

  it("creates multiple pages for long text content", async () => {
    const repo = new InMemoryNoteRepository();
    const notesService = new NotesService(repo);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Long Note"
    });

    let capturedBytes: Buffer | null = null;
    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async (input) => {
      capturedBytes = input.bytes;
      return {
        blobName: "note-1/long.pdf",
        url: "https://storage.example/note-1/long.pdf"
      };
    });

    const longText = Array.from({ length: 500 }, (_, index) => `word${index}`).join(" ");

    const exportService = new PdfExportService(repo, { savePdf }, {
      resolveText: () => longText
    });

    await exportService.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });

    if (!capturedBytes) {
      throw new Error("captured bytes are missing");
    }

    const parsed = await PDFDocument.load(capturedBytes);
    expect(parsed.getPageCount()).toBeGreaterThan(1);
  });

  it("loads stroke data and still exports a valid PDF", async () => {
    const repo = new InMemoryNoteRepository();
    const notesService = new NotesService(repo);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Stroke Note"
    });

    let capturedBytes: Buffer | null = null;
    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async (input) => {
      capturedBytes = input.bytes;
      return {
        blobName: "note-1/stroke.pdf",
        url: "https://storage.example/note-1/stroke.pdf"
      };
    });

    const listByNoteId = vi.fn<
      (noteId: string) => Promise<NoteStroke[]>
    >(async () => [
      {
        toolType: "pen",
        color: "#1f2937",
        width: 2,
        points: [
          { x: 100, y: 600 },
          { x: 160, y: 620 },
          { x: 240, y: 640 }
        ]
      }
    ]);

    const exportService = new PdfExportService(
      repo,
      { savePdf },
      { strokeProvider: { listByNoteId } }
    );

    await exportService.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });

    expect(listByNoteId).toHaveBeenCalledWith("note-1");

    if (!capturedBytes) {
      throw new Error("captured bytes are missing");
    }

    const parsed = await PDFDocument.load(capturedBytes);
    expect(parsed.getPageCount()).toBeGreaterThan(0);
  });

  it("renders strokes on later pages when pageIndex is provided", async () => {
    const repo = new InMemoryNoteRepository();
    const notesService = new NotesService(repo);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Paged Stroke"
    });

    let capturedBytes: Buffer | null = null;
    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async (input) => {
      capturedBytes = input.bytes;
      return {
        blobName: "note-1/paged-stroke.pdf",
        url: "https://storage.example/note-1/paged-stroke.pdf"
      };
    });

    const listByNoteId = vi.fn<
      (noteId: string) => Promise<NoteStroke[]>
    >(async () => [
      {
        pageIndex: 1,
        toolType: "pen",
        color: "#111111",
        width: 2,
        points: [
          { x: 10, y: 10 },
          { x: 100, y: 100 }
        ]
      }
    ]);

    const exportService = new PdfExportService(
      repo,
      { savePdf },
      { strokeProvider: { listByNoteId } }
    );

    await exportService.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });

    if (!capturedBytes) {
      throw new Error("captured bytes are missing");
    }

    const parsed = await PDFDocument.load(capturedBytes);
    expect(parsed.getPageCount()).toBe(2);
  });

  it("uses page-scoped text source to preserve note page boundaries", async () => {
    const repo = new InMemoryNoteRepository();
    const notesService = new NotesService(repo);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Page Source"
    });

    let capturedBytes: Buffer | null = null;
    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async (input) => {
      capturedBytes = input.bytes;
      return {
        blobName: "note-1/page-source.pdf",
        url: "https://storage.example/note-1/page-source.pdf"
      };
    });

    const exportService = new PdfExportService(repo, { savePdf }, {
      resolvePageTexts: () => ["page-one content", "page-two content"]
    });

    await exportService.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });

    if (!capturedBytes) {
      throw new Error("captured bytes are missing");
    }

    const parsed = await PDFDocument.load(capturedBytes);
    expect(parsed.getPageCount()).toBe(2);
  });

  it("loads page contents from provider when resolvePageTexts is absent", async () => {
    const repo = new InMemoryNoteRepository();
    const notesService = new NotesService(repo);

    await notesService.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Provider Page Source"
    });

    let capturedBytes: Buffer | null = null;
    const savePdf = vi.fn<
      (input: { noteId: string; bytes: Buffer }) => Promise<{ blobName: string; url: string }>
    >(async (input) => {
      capturedBytes = input.bytes;
      return {
        blobName: "note-1/page-provider.pdf",
        url: "https://storage.example/note-1/page-provider.pdf"
      };
    });

    const listPageContentsByNoteId = vi.fn<
      (noteId: string) => Promise<NotePageContent[]>
    >(async () => [
      { pageIndex: 1, text: "second page" },
      { pageIndex: 0, text: "first page" }
    ]);

    const exportService = new PdfExportService(repo, { savePdf }, {
      pageContentProvider: { listPageContentsByNoteId }
    });

    await exportService.exportNoteAsPdf({ noteId: "note-1", userId: "user-1" });

    expect(listPageContentsByNoteId).toHaveBeenCalledWith("note-1");

    if (!capturedBytes) {
      throw new Error("captured bytes are missing");
    }

    const parsed = await PDFDocument.load(capturedBytes);
    expect(parsed.getPageCount()).toBe(2);
  });
});
