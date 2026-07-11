export type StrokePoint = {
  x: number;
  y: number;
};

export type NoteStroke = {
  pageIndex?: number;
  toolType: "pen" | "highlighter" | "eraser";
  color: string;
  width: number;
  points: StrokePoint[];
};

export interface StrokeProviderPort {
  listByNoteId(noteId: string): Promise<NoteStroke[]>;
}

export interface StrokeRepositoryPort extends StrokeProviderPort {
  replaceByNoteId(noteId: string, strokes: NoteStroke[]): Promise<void>;
}
