import type { NotePageContent } from "./note-page-content.port";
import type { NoteStroke } from "./stroke.port";

export type ReplaceNoteContentAtomicallyInput = {
  noteId: string;
  expectedVersion: number;
  pages: NotePageContent[];
  strokes: NoteStroke[];
};

export type ReplaceNoteContentAtomicallyResult =
  | { status: "updated"; noteVersion: number }
  | { status: "conflict"; actualVersion: number };

export interface NoteContentTransactionalWriterPort {
  replaceNoteContentAtomically(
    input: ReplaceNoteContentAtomicallyInput
  ): Promise<ReplaceNoteContentAtomicallyResult>;
}
