import request from "supertest";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { NoteContentService } from "../application/note-content.service";
import { InMemoryNotePageContentRepository } from "../application/note-page-content.repository.in-memory";
import { NotePageContentService } from "../application/note-page-content.service";
import { InMemoryNoteRepository } from "../application/notes.repository.in-memory";
import { NotesService } from "../application/notes.service";
import { PdfExportService } from "../application/pdf-export.service";
import { InMemoryStrokeRepository } from "../application/stroke.repository.in-memory";
import { StrokeService } from "../application/stroke.service";
import { createApp } from "./app";

describe("Express app adapter", () => {
  it("returns health check", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const app = createApp(service);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("creates and lists notes through HTTP endpoints", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const app = createApp(service);

    const createRes = await request(app).post("/notes").send({
      id: "note-1",
      userId: "user-1",
      title: "First"
    });

    expect(createRes.status).toBe(201);

    const listRes = await request(app).get("/notes").query({ userId: "user-1" });

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe("note-1");
  });

  it("returns 409 when rename request conflicts", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const app = createApp(service);

    await request(app).post("/notes").send({
      id: "note-1",
      userId: "user-1",
      title: "Original"
    });

    await request(app).post("/notes/rename").send({
      noteId: "note-1",
      userId: "user-1",
      title: "Updated Once",
      expectedVersion: 1
    });

    const conflictRes = await request(app).post("/notes/rename").send({
      noteId: "note-1",
      userId: "user-1",
      title: "Stale Update",
      expectedVersion: 1
    });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.message).toBe("version conflict");
  });

  it("returns 401 when auth is required and bearer token is missing", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const app = createApp(service, {
      requireAuth: true,
      verifyToken: async () => ({ sub: "user-1" })
    });

    const res = await request(app).get("/notes").query({ userId: "user-1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("missing bearer token");
  });

  it("allows notes request when auth is required and token is valid", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const app = createApp(service, {
      requireAuth: true,
      verifyToken: async () => ({ sub: "user-1" })
    });

    await request(app)
      .post("/notes")
      .set("Authorization", "Bearer good-token")
      .send({
        id: "note-1",
        userId: "user-1",
        title: "Protected Note"
      });

    const listRes = await request(app)
      .get("/notes")
      .set("Authorization", "Bearer good-token")
      .query({ userId: "user-1" });

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it("exports note to pdf with POST /notes/:noteId/export/pdf", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Export Me"
    });

    const pdfExportService = new PdfExportService(repo, {
      savePdf: async () => ({
        blobName: "note-1/1700000000000.pdf",
        url: "https://storage.example/note-1/1700000000000.pdf"
      })
    });

    const app = createApp(service, { pdfExportService });

    const res = await request(app)
      .post("/notes/note-1/export/pdf")
      .send({ userId: "user-1" });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe("https://storage.example/note-1/1700000000000.pdf");
  });

  it("returns 404 when exporting non-existing note", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pdfExportService = new PdfExportService(repo, {
      savePdf: async () => ({
        blobName: "x",
        url: "x"
      })
    });

    const app = createApp(service, { pdfExportService });

    const res = await request(app)
      .post("/notes/missing/export/pdf")
      .send({ userId: "user-1" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("note not found");
  });

  it("saves and lists note pages through HTTP endpoints", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const notePageContentService = new NotePageContentService(
      repo,
      new InMemoryNotePageContentRepository()
    );

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Paged Note"
    });

    const app = createApp(service, { notePageContentService });

    const saveRes = await request(app).post("/notes/pages").send({
      noteId: "note-1",
      userId: "user-1",
      pages: [
        { pageIndex: 0, text: "first" },
        { pageIndex: 1, text: "second" }
      ]
    });

    expect(saveRes.status).toBe(200);

    const listRes = await request(app)
      .get("/notes/pages")
      .query({ noteId: "note-1", userId: "user-1" });

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(2);
    expect(listRes.body[0].pageIndex).toBe(0);
  });

  it("exports pdf using stored page contents and strokes", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pageRepository = new InMemoryNotePageContentRepository();
    const notePageContentService = new NotePageContentService(repo, pageRepository);
    const strokeRepository = new InMemoryStrokeRepository();

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Integrated Export"
    });

    await notePageContentService.saveNotePages({
      noteId: "note-1",
      userId: "user-1",
      pages: [
        { pageIndex: 0, text: "Page 1" },
        { pageIndex: 1, text: "Page 2" }
      ]
    });

    await strokeRepository.replaceByNoteId("note-1", [
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

    let uploadCount = 0;
    const pdfExportService = new PdfExportService(
      repo,
      {
        savePdf: async () => {
          uploadCount += 1;
          return {
            blobName: "note-1/integrated.pdf",
            url: "https://storage.example/note-1/integrated.pdf"
          };
        }
      },
      {
        pageContentProvider: pageRepository,
        strokeProvider: strokeRepository
      }
    );

    const app = createApp(service, { pdfExportService, notePageContentService });
    const res = await request(app).post("/notes/note-1/export/pdf").send({ userId: "user-1" });

    expect(res.status).toBe(201);
    expect(uploadCount).toBe(1);
    expect(res.body.url).toContain("integrated.pdf");
  });

  it("saves and lists note strokes through HTTP endpoints", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const strokeService = new StrokeService(repo, new InMemoryStrokeRepository());

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Stroke Note"
    });

    const app = createApp(service, { strokeService });

    const saveRes = await request(app).post("/notes/strokes").send({
      noteId: "note-1",
      userId: "user-1",
      strokes: [
        {
          pageIndex: 0,
          toolType: "pen",
          color: "#111111",
          width: 2,
          points: [
            { x: 1, y: 2 },
            { x: 3, y: 4 }
          ]
        }
      ]
    });

    expect(saveRes.status).toBe(200);

    const listRes = await request(app)
      .get("/notes/strokes")
      .query({ noteId: "note-1", userId: "user-1" });

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].toolType).toBe("pen");
  });

  it("saves note content and export reflects replacement", async () => {
    const repo = new InMemoryNoteRepository();
    const service = new NotesService(repo);
    const pageRepository = new InMemoryNotePageContentRepository();
    const strokeRepository = new InMemoryStrokeRepository();
    const noteContentService = new NoteContentService(repo, pageRepository, strokeRepository);

    await service.createNote({
      id: "note-1",
      userId: "user-1",
      title: "Combined Save"
    });

    let capturedBytes: Buffer | null = null;
    const pdfExportService = new PdfExportService(
      repo,
      {
        savePdf: async (input) => {
          capturedBytes = input.bytes;
          return {
            blobName: "note-1/combined.pdf",
            url: "https://storage.example/note-1/combined.pdf"
          };
        }
      },
      {
        pageContentProvider: pageRepository,
        strokeProvider: strokeRepository
      }
    );

    const app = createApp(service, { noteContentService, pdfExportService });

    const saveFirst = await request(app).post("/notes/content").send({
      noteId: "note-1",
      userId: "user-1",
      expectedVersion: 1,
      pages: [
        { pageIndex: 0, text: "first" },
        { pageIndex: 1, text: "second" }
      ],
      strokes: [
        {
          pageIndex: 1,
          toolType: "pen",
          color: "#111111",
          width: 2,
          points: [
            { x: 1, y: 2 },
            { x: 3, y: 4 }
          ]
        }
      ]
    });

    expect(saveFirst.status).toBe(200);

    const saveSecond = await request(app).post("/notes/content").send({
      noteId: "note-1",
      userId: "user-1",
      expectedVersion: 2,
      pages: [{ pageIndex: 0, text: "single" }],
      strokes: []
    });

    expect(saveSecond.status).toBe(200);

    const exportRes = await request(app)
      .post("/notes/note-1/export/pdf")
      .send({ userId: "user-1" });

    expect(exportRes.status).toBe(201);

    if (!capturedBytes) {
      throw new Error("captured bytes are missing");
    }

    const parsed = await PDFDocument.load(capturedBytes);
    expect(parsed.getPageCount()).toBe(1);
  });
});
