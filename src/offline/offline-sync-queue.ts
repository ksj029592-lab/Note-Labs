export type DrainResult = {
  processed: number;
  failed: number;
};

export class OfflineSyncQueue<T> {
  private readonly queue: T[] = [];

  enqueue(item: T): void {
    this.queue.push(item);
  }

  size(): number {
    return this.queue.length;
  }

  async drain(processor: (item: T) => Promise<void>): Promise<DrainResult> {
    let processed = 0;
    let failed = 0;

    const remaining: T[] = [];

    for (const item of this.queue) {
      try {
        await processor(item);
        processed += 1;
      } catch {
        remaining.push(item);
        failed += 1;
      }
    }

    this.queue.length = 0;
    this.queue.push(...remaining);

    return { processed, failed };
  }
}
