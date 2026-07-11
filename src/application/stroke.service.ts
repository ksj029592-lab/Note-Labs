import type { NoteRepository } from "./notes.repository";
import type { NoteStroke, StrokeRepositoryPort } from "./stroke.port";

type SaveNoteStrokesInput = {
  noteId: string;
  userId: string;
  strokes: NoteStroke[];
};

export class StrokeService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly strokeRepository: StrokeRepositoryPort
  ) {}

  async saveNoteStrokes(input: SaveNoteStrokesInput): Promise<NoteStroke[]> {
    const note = await this.noteRepository.findById(input.noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== input.userId) {
      throw new Error("forbidden");
    }

    this.validateStrokes(input.strokes);
    await this.strokeRepository.replaceByNoteId(input.noteId, input.strokes);

    return this.strokeRepository.listByNoteId(input.noteId);
  }

  async listNoteStrokes(noteId: string, userId: string): Promise<NoteStroke[]> {
    const note = await this.noteRepository.findById(noteId);

    if (!note) {
      throw new Error("note not found");
    }

    if (note.userId !== userId) {
      throw new Error("forbidden");
    }

    return this.strokeRepository.listByNoteId(noteId);
  }

  private validateStrokes(strokes: NoteStroke[]): void {
    for (const stroke of strokes) {
      if (
        stroke.toolType !== "pen" &&
        stroke.toolType !== "highlighter" &&
        stroke.toolType !== "eraser"
      ) {
        throw new Error("invalid toolType");
      }

      if (typeof stroke.color !== "string" || !stroke.color.trim()) {
        throw new Error("color must not be empty");
      }

      if (typeof stroke.width !== "number" || stroke.width <= 0) {
        throw new Error("width must be greater than zero");
      }

      if (!Array.isArray(stroke.points)) {
        throw new Error("points must be an array");
      }

      for (const point of stroke.points) {
        if (typeof point.x !== "number" || typeof point.y !== "number") {
          throw new Error("point coordinates must be numbers");
        }
      }
    }
  }
}
