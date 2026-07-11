export type NotePageContent = {
  pageIndex: number;
  text: string;
};

export interface NotePageContentProviderPort {
  listPageContentsByNoteId(noteId: string): Promise<NotePageContent[]>;
}

export interface NotePageContentRepositoryPort extends NotePageContentProviderPort {
  replacePageContents(noteId: string, pages: NotePageContent[]): Promise<void>;
}
