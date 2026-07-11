import { Note } from "../domain/note";
import type { ConflictCopy, NoteRepository } from "./notes.repository";

type CreateNoteInput = {
  id: string;
  userId: string;
  title: string;
};

type RenameNoteInput = {
  noteId: string;
  userId: string;
  title: string;
  expectedVersion: number;
};

type RenameNoteResult =
  | { status: "updated"; note: Note }
  | { status: "conflict"; conflictCopy: ConflictCopy };

export class NotesService {
  constructor(private readonly noteRepository: NoteRepository) {}

  async createNote(input: CreateNoteInput): Promise<Note> {
    const note = Note.create(input);
    await this.noteRepository.save(note);
    return note;
  }

  async listNotes(userId: string): Promise<Note[]> {
    return this.noteRepository.listByUserId(userId);
  }

  async renameNote(input: RenameNoteInput): Promise<RenameNoteResult> {
    const note = await this.noteRepository.findById(input.noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== input.userId) {
      throw new Error("forbidden");
    }

    if (note.version !== input.expectedVersion) {
      const conflictCopy: ConflictCopy = {
        id: `conflict-${input.noteId}-${Date.now()}`,
        originalNoteId: input.noteId,
        userId: input.userId,
        attemptedTitle: input.title,
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

    note.rename(input.title);
    await this.noteRepository.save(note);

    return {
      status: "updated",
      note
    };
  }

  async listConflictCopies(originalNoteId: string): Promise<ConflictCopy[]> {
    return this.noteRepository.listConflictCopiesByOriginalId(originalNoteId);
  }
}
