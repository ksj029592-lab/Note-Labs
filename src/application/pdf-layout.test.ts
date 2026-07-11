import { describe, expect, it } from "vitest";
import { paginateLines, wrapTextToLines } from "./pdf-layout";

describe("pdf-layout", () => {
  it("wraps long text into multiple lines", () => {
    const lines = wrapTextToLines("alpha beta gamma delta epsilon zeta eta theta", 12);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 12)).toBe(true);
  });

  it("paginates lines by max lines per page", () => {
    const lines = Array.from({ length: 95 }, (_, index) => `line-${index + 1}`);
    const pages = paginateLines(lines, 40);

    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(40);
    expect(pages[1]).toHaveLength(40);
    expect(pages[2]).toHaveLength(15);
  });
});
