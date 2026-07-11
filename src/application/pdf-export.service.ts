import type { NoteRepository } from "./notes.repository";
import type { PdfStoragePort } from "./pdf-storage.port";
import type { Note } from "../domain/note";
import type { NotePageContentProviderPort } from "./note-page-content.port";
import type { NoteStroke, StrokeProviderPort } from "./stroke.port";
import { paginateLines, wrapTextToLines } from "./pdf-layout";
import {
  DEFAULT_CANVAS_VIEWPORT,
  DEFAULT_PDF_VIEWPORT,
  mapCanvasPointToPdf,
  type CanvasViewport
} from "./pdf-coordinate";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

type ExportNotePdfInput = {
  noteId: string;
  userId: string;
};

type PdfExportRenderOptions = {
  resolveText?: (note: Note) => string;
  resolvePageTexts?: (note: Note) => string[];
  pageContentProvider?: NotePageContentProviderPort;
  strokeProvider?: StrokeProviderPort;
  canvasViewport?: CanvasViewport;
};

export class PdfExportService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly pdfStorage: PdfStoragePort,
    private readonly options: PdfExportRenderOptions = {}
  ) {}

  async exportNoteAsPdf(input: ExportNotePdfInput): Promise<{ blobName: string; url: string }> {
    const note = await this.noteRepository.findById(input.noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== input.userId) {
      throw new Error("forbidden");
    }

    const pageTexts = await this.resolvePageTexts(note);
    const text = this.options.resolveText?.(note) ?? note.title;
    const strokes = this.options.strokeProvider
      ? await this.options.strokeProvider.listByNoteId(note.id)
      : [];

    const bytes = await this.renderPdfWithPdfLib(note.title, text, pageTexts, strokes);

    return this.pdfStorage.savePdf({
      noteId: note.id,
      bytes
    });
  }

  private async resolvePageTexts(note: Note): Promise<string[]> {
    if (this.options.resolvePageTexts) {
      return this.options.resolvePageTexts(note);
    }

    if (!this.options.pageContentProvider) {
      return [];
    }

    const pageContents = await this.options.pageContentProvider.listPageContentsByNoteId(note.id);

    return pageContents
      .slice()
      .sort((left, right) => left.pageIndex - right.pageIndex)
      .map((page) => page.text);
  }

  private async renderPdfWithPdfLib(
    title: string,
    text: string,
    pageTexts: string[],
    strokes: NoteStroke[]
  ): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(title);

    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const textPages = this.buildTextPages(text, pageTexts);
    const maxStrokePage = strokes.reduce((maxPage, stroke) => {
      return Math.max(maxPage, stroke.pageIndex ?? 0);
    }, 0);
    const totalPageCount = Math.max(textPages.length, maxStrokePage + 1);
    const pages: PDFPage[] = [];

    for (let pageIndex = 0; pageIndex < totalPageCount; pageIndex += 1) {
      const page = pdf.addPage([595, 842]);
      pages.push(page);

      const pageLines = textPages[pageIndex] ?? [];
      let y = 790;

      for (const line of pageLines) {
        page.drawText(line, {
          x: 72,
          y,
          size: 13,
          font,
          color: rgb(0.1, 0.1, 0.1)
        });

        y -= 18;
      }
    }

    if (strokes.length > 0) {
      this.drawStrokesByPage(pages, strokes);
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  private buildTextPages(text: string, pageTexts: string[]): string[][] {
    if (pageTexts.length === 0) {
      return paginateLines(wrapTextToLines(text, 65), 38);
    }

    return pageTexts.map((pageText) => {
      return wrapTextToLines(pageText, 65).slice(0, 38);
    });
  }

  private drawStrokesByPage(pages: PDFPage[], strokes: NoteStroke[]): void {
    const canvasViewport = this.options.canvasViewport ?? DEFAULT_CANVAS_VIEWPORT;

    for (const stroke of strokes) {
      if (stroke.points.length < 2) {
        continue;
      }

      const pageIndex = Math.max(0, Math.min(stroke.pageIndex ?? 0, pages.length - 1));
      const page = pages[pageIndex];

      for (let index = 1; index < stroke.points.length; index += 1) {
        const from = mapCanvasPointToPdf(stroke.points[index - 1], canvasViewport, DEFAULT_PDF_VIEWPORT);
        const to = mapCanvasPointToPdf(stroke.points[index], canvasViewport, DEFAULT_PDF_VIEWPORT);

        page.drawLine({
          start: { x: from.x, y: from.y },
          end: { x: to.x, y: to.y },
          thickness: Math.max(1, stroke.width),
          color: this.parseColor(stroke.color)
        });
      }
    }
  }

  private parseColor(hexColor: string) {
    const normalized = hexColor.replace("#", "").trim();

    if (normalized.length !== 6) {
      return rgb(0.1, 0.1, 0.1);
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
    const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

    return rgb(red, green, blue);
  }
}
