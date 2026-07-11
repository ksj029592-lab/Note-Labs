import type {
  NotePageContent,
  NotePageContentRepositoryPort
} from "./note-page-content.port";
import { createHash } from "node:crypto";
import type { NoteContentTransactionalWriterPort } from "./note-content-transaction.port";
import type { ConflictCopy } from "./notes.repository";
import type { NoteRepository } from "./notes.repository";
import type { NoteStroke, StrokeRepositoryPort } from "./stroke.port";

type SaveNoteContentInput = {
  noteId: string;
  userId: string;
  expectedVersion: number;
  pages: NotePageContent[];
  strokes: NoteStroke[];
};

export type NoteContentSnapshot = {
  pages: NotePageContent[];
  strokes: NoteStroke[];
};

export type SaveNoteContentResult =
  | { status: "updated"; content: NoteContentSnapshot; noteVersion: number }
  | { status: "conflict"; conflictCopy: ConflictCopy };

export class NoteContentService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly pageContentRepository: NotePageContentRepositoryPort,
    private readonly strokeRepository: StrokeRepositoryPort,
    private readonly transactionalWriter?: NoteContentTransactionalWriterPort
  ) {}

  async saveNoteContent(input: SaveNoteContentInput): Promise<SaveNoteContentResult> {
    const note = await this.noteRepository.findById(input.noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== input.userId) {
      throw new Error("forbidden");
    }

    if (!this.transactionalWriter && note.version !== input.expectedVersion) {
      const attemptedPayloadHash = this.computePayloadHash(input.pages, input.strokes);
      const conflictCopy: ConflictCopy = {
        id: `conflict-${input.noteId}-${Date.now()}`,
        originalNoteId: input.noteId,
        userId: input.userId,
        attemptedTitle: "content update",
        attemptedPayloadHash,
        attemptedPagesCount: input.pages.length,
        attemptedStrokesCount: input.strokes.length,
        expectedVersion: input.expectedVersion,
        actualVersion: note.version,
        createdAt: new Date()
      };

      await this.noteRepository.saveConflictCopy(conflictCopy);

      return {
        status: "conflict",
        conflictCopy
      };
    }

    if (this.transactionalWriter) {
      const atomicResult = await this.transactionalWriter.replaceNoteContentAtomically({
        noteId: input.noteId,
        expectedVersion: input.expectedVersion,
        pages: input.pages,
        strokes: input.strokes
      });

      if (atomicResult.status === "conflict") {
        const attemptedPayloadHash = this.computePayloadHash(input.pages, input.strokes);
        const conflictCopy: ConflictCopy = {
          id: `conflict-${input.noteId}-${Date.now()}`,
          originalNoteId: input.noteId,
          userId: input.userId,
          attemptedTitle: "content update",
          attemptedPayloadHash,
          attemptedPagesCount: input.pages.length,
          attemptedStrokesCount: input.strokes.length,
          expectedVersion: input.expectedVersion,
          actualVersion: atomicResult.actualVersion,
          createdAt: new Date()
        };

        await this.noteRepository.saveConflictCopy(conflictCopy);

        return {
          status: "conflict",
          conflictCopy
        };
      }

      const pages = await this.pageContentRepository.listPageContentsByNoteId(input.noteId);
      const strokes = await this.strokeRepository.listByNoteId(input.noteId);

      return {
        status: "updated",
        content: { pages, strokes },
        noteVersion: atomicResult.noteVersion
      };
    }

    await this.pageContentRepository.replacePageContents(input.noteId, input.pages);
    await this.strokeRepository.replaceByNoteId(input.noteId, input.strokes);
    note.version += 1;
    await this.noteRepository.save(note);

    const pages = await this.pageContentRepository.listPageContentsByNoteId(input.noteId);
    const strokes = await this.strokeRepository.listByNoteId(input.noteId);

    return {
      status: "updated",
      content: { pages, strokes },
      noteVersion: note.version
    };
  }

  private computePayloadHash(pages: NotePageContent[], strokes: NoteStroke[]): string {
    const stable = {
      pages: pages
        .slice()
        .sort((left, right) => left.pageIndex - right.pageIndex)
        .map((page) => ({ pageIndex: page.pageIndex, text: page.text })),
      strokes: strokes.map((stroke) => ({
        pageIndex: stroke.pageIndex ?? null,
        toolType: stroke.toolType,
        color: stroke.color,
        width: stroke.width,
        points: stroke.points.map((point) => ({ x: point.x, y: point.y }))
      }))
    };

    return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
  }
}
