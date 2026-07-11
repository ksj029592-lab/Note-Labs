import type { NoteStroke, StrokeRepositoryPort } from "./stroke.port";

export class InMemoryStrokeRepository implements StrokeRepositoryPort {
  private readonly strokesByNoteId = new Map<string, NoteStroke[]>();

  async replaceByNoteId(noteId: string, strokes: NoteStroke[]): Promise<void> {
    const cloned = strokes.map((stroke) => ({
      pageIndex: stroke.pageIndex,
      toolType: stroke.toolType,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points.map((point) => ({ x: point.x, y: point.y }))
    }));

    this.strokesByNoteId.set(noteId, cloned);
  }

  async listByNoteId(noteId: string): Promise<NoteStroke[]> {
    return (this.strokesByNoteId.get(noteId) ?? []).map((stroke) => ({
      pageIndex: stroke.pageIndex,
      toolType: stroke.toolType,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points.map((point) => ({ x: point.x, y: point.y }))
    }));
  }
}
