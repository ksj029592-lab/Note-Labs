import { Note } from "../domain/note";
import type { ConflictCopy, NoteRepository } from "./notes.repository";

export class InMemoryNoteRepository implements NoteRepository {
  private readonly notes = new Map<string, Note>();
  private readonly conflictCopies = new Map<string, ConflictCopy[]>();

  async save(note: Note): Promise<void> {
    this.notes.set(note.id, note);
  }

  async findById(noteId: string): Promise<Note | null> {
    return this.notes.get(noteId) ?? null;
  }

  async listByUserId(userId: string): Promise<Note[]> {
    return [...this.notes.values()].filter((note) => note.userId === userId);
  }

  async saveConflictCopy(conflictCopy: ConflictCopy): Promise<void> {
    const existing = this.conflictCopies.get(conflictCopy.originalNoteId) ?? [];
    existing.push(conflictCopy);
    this.conflictCopies.set(conflictCopy.originalNoteId, existing);
  }

  async listConflictCopiesByOriginalId(originalNoteId: string): Promise<ConflictCopy[]> {
    return [...(this.conflictCopies.get(originalNoteId) ?? [])];
  }
}
