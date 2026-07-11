import { describe, expect, it } from "vitest";
import { OfflineSyncQueue } from "./offline-sync-queue";

describe("OfflineSyncQueue", () => {
  it("drains queued operations in FIFO order", async () => {
    const queue = new OfflineSyncQueue<{ id: string }>();
    const processed: string[] = [];

    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "b" });
    queue.enqueue({ id: "c" });

    const result = await queue.drain(async (item) => {
      processed.push(item.id);
    });

    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
    expect(processed).toEqual(["a", "b", "c"]);
    expect(queue.size()).toBe(0);
  });

  it("keeps failed items in queue for retry", async () => {
    const queue = new OfflineSyncQueue<{ id: string }>();

    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "b" });

    const result = await queue.drain(async (item) => {
      if (item.id === "b") {
        throw new Error("temporary failure");
      }
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(queue.size()).toBe(1);

    const retried: string[] = [];

    const second = await queue.drain(async (item) => {
      retried.push(item.id);
    });

    expect(second.processed).toBe(1);
    expect(second.failed).toBe(0);
    expect(retried).toEqual(["b"]);
    expect(queue.size()).toBe(0);
  });
});
