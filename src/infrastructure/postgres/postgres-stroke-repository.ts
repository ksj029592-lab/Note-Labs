import type { NoteStroke, StrokeRepositoryPort } from "../../application/stroke.port";

type QueryResultRow = Record<string, unknown>;

type QueryResult = {
  rows: QueryResultRow[];
  rowCount: number | null;
};

type Queryable = {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
};

type StrokeRow = {
  page_index: number | null;
  tool_type: "pen" | "highlighter" | "eraser";
  color: string;
  width: number;
  points_json: unknown;
};

function toPoints(pointsJson: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(pointsJson)) {
    return [];
  }

  return pointsJson
    .map((value) => {
      if (!value || typeof value !== "object") {
        return null;
      }

      const candidate = value as Record<string, unknown>;
      if (typeof candidate.x !== "number" || typeof candidate.y !== "number") {
        return null;
      }

      return { x: candidate.x, y: candidate.y };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
}

export class PostgresStrokeRepository implements StrokeRepositoryPort {
  constructor(private readonly db: Queryable) {}

  async replaceByNoteId(noteId: string, strokes: NoteStroke[]): Promise<void> {
    await this.db.query(
      `delete from note_strokes
       where note_id = $1`,
      [noteId]
    );

    for (let index = 0; index < strokes.length; index += 1) {
      const stroke = strokes[index];
      await this.db.query(
        `insert into note_strokes (
          id,
          note_id,
          page_index,
          tool_type,
          color,
          width,
          points_json,
          created_at,
          updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())`,
        [
          `${noteId}:stroke:${index}`,
          noteId,
          stroke.pageIndex ?? null,
          stroke.toolType,
          stroke.color,
          stroke.width,
          JSON.stringify(stroke.points)
        ]
      );
    }
  }

  async listByNoteId(noteId: string): Promise<NoteStroke[]> {
    const result = await this.db.query(
      `select page_index, tool_type, color, width, points_json
       from note_strokes
       where note_id = $1
       order by created_at asc`,
      [noteId]
    );

    return result.rows.map((row) => {
      const typed = row as StrokeRow;
      return {
        pageIndex: typed.page_index ?? undefined,
        toolType: typed.tool_type,
        color: typed.color,
        width: typed.width,
        points: toPoints(typed.points_json)
      };
    });
  }
}
