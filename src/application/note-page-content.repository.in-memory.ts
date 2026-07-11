import type {
  NotePageContent,
  NotePageContentRepositoryPort
} from "./note-page-content.port";

export class InMemoryNotePageContentRepository implements NotePageContentRepositoryPort {
  private readonly pagesByNoteId = new Map<string, NotePageContent[]>();

  async replacePageContents(noteId: string, pages: NotePageContent[]): Promise<void> {
    const normalized = pages
      .slice()
      .sort((left, right) => left.pageIndex - right.pageIndex)
      .map((page) => ({
        pageIndex: page.pageIndex,
        text: page.text
      }));

    this.pagesByNoteId.set(noteId, normalized);
  }

  async listPageContentsByNoteId(noteId: string): Promise<NotePageContent[]> {
    return (this.pagesByNoteId.get(noteId) ?? []).map((page) => ({
      pageIndex: page.pageIndex,
      text: page.text
    }));
  }
}
