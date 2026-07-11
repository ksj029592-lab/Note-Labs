type CreateNoteParams = {
  id: string;
  userId: string;
  title: string;
};

type RehydrateNoteParams = {
  id: string;
  userId: string;
  title: string;
  version: number;
  deletedAt: Date | null;
};

function normalizeTitle(title: string): string {
  return title.trim();
}

export class Note {
  public readonly id: string;
  public readonly userId: string;
  public title: string;
  public version: number;
  public deletedAt: Date | null;

  private constructor(params: {
    id: string;
    userId: string;
    title: string;
    version: number;
    deletedAt: Date | null;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.title = params.title;
    this.version = params.version;
    this.deletedAt = params.deletedAt;
  }

  static create(params: CreateNoteParams): Note {
    const title = normalizeTitle(params.title);

    if (!title) {
      throw new Error("title must not be empty");
    }

    return new Note({
      id: params.id,
      userId: params.userId,
      title,
      version: 1,
      deletedAt: null
    });
  }

  static rehydrate(params: RehydrateNoteParams): Note {
    const title = normalizeTitle(params.title);

    if (!title) {
      throw new Error("title must not be empty");
    }

    return new Note({
      id: params.id,
      userId: params.userId,
      title,
      version: params.version,
      deletedAt: params.deletedAt
    });
  }

  rename(nextTitle: string): void {
    if (this.deletedAt) {
      throw new Error("cannot rename deleted note");
    }

    const normalized = normalizeTitle(nextTitle);

    if (!normalized) {
      throw new Error("title must not be empty");
    }

    this.title = normalized;
    this.version += 1;
  }

  softDelete(at: Date = new Date()): void {
    if (this.deletedAt) {
      return;
    }

    this.deletedAt = at;
    this.version += 1;
  }
}
