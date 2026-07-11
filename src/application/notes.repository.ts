import { Note } from "../domain/note";

export type ConflictCopy = {
  id: string;
  originalNoteId: string;
  userId: string;
  attemptedTitle: string;
  attemptedPayloadHash?: string;
  attemptedPagesCount?: number;
  attemptedStrokesCount?: number;
  expectedVersion: number;
  actualVersion: number;
  createdAt: Date;
};

export interface NoteRepository {
  save(note: Note): Promise<void>;
  findById(noteId: string): Promise<Note | null>;
  listByUserId(userId: string): Promise<Note[]>;
  saveConflictCopy(conflictCopy: ConflictCopy): Promise<void>;
  listConflictCopiesByOriginalId(originalNoteId: string): Promise<ConflictCopy[]>;
}
