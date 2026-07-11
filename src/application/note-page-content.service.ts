import type { NoteRepository } from "./notes.repository";
import type {
  NotePageContent,
  NotePageContentRepositoryPort
} from "./note-page-content.port";

type SaveNotePagesInput = {
  noteId: string;
  userId: string;
  pages: NotePageContent[];
};

export class NotePageContentService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly pageContentRepository: NotePageContentRepositoryPort
  ) {}

  async saveNotePages(input: SaveNotePagesInput): Promise<NotePageContent[]> {
    const note = await this.noteRepository.findById(input.noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== input.userId) {
      throw new Error("forbidden");
    }

    this.validatePages(input.pages);
    await this.pageContentRepository.replacePageContents(input.noteId, input.pages);

    return this.pageContentRepository.listPageContentsByNoteId(input.noteId);
  }

  async listNotePages(noteId: string, userId: string): Promise<NotePageContent[]> {
    const note = await this.noteRepository.findById(noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== userId) {
      throw new Error("forbidden");
    }

    return this.pageContentRepository.listPageContentsByNoteId(noteId);
  }

  private validatePages(pages: NotePageContent[]): void {
    for (const page of pages) {
      if (!Number.isInteger(page.pageIndex) || page.pageIndex < 0) {
        throw new Error("pageIndex must be a non-negative integer");
      }

      if (typeof page.text !== "string") {
        throw new Error("text must be a string");
      }
    }
  }
}
