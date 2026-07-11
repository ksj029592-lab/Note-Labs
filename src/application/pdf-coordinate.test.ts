import { describe, expect, it } from "vitest";
import {
  DEFAULT_CANVAS_VIEWPORT,
  DEFAULT_PDF_VIEWPORT,
  mapCanvasPointToPdf
} from "./pdf-coordinate";

describe("pdf-coordinate", () => {
  it("maps top-left canvas point to top-left content area in PDF", () => {
    const mapped = mapCanvasPointToPdf({ x: 0, y: 0 }, DEFAULT_CANVAS_VIEWPORT);

    expect(mapped.x).toBeCloseTo(DEFAULT_PDF_VIEWPORT.marginX, 5);
    expect(mapped.y).toBeCloseTo(
      DEFAULT_PDF_VIEWPORT.pageHeight - DEFAULT_PDF_VIEWPORT.marginTop,
      5
    );
  });

  it("maps bottom-right canvas point to bottom-right content area in PDF", () => {
    const mapped = mapCanvasPointToPdf(
      { x: DEFAULT_CANVAS_VIEWPORT.width, y: DEFAULT_CANVAS_VIEWPORT.height },
      DEFAULT_CANVAS_VIEWPORT
    );

    expect(mapped.x).toBeCloseTo(DEFAULT_PDF_VIEWPORT.pageWidth - DEFAULT_PDF_VIEWPORT.marginX, 5);
    expect(mapped.y).toBeCloseTo(DEFAULT_PDF_VIEWPORT.marginBottom, 5);
  });

  it("clamps out-of-range canvas points into PDF content bounds", () => {
    const mapped = mapCanvasPointToPdf({ x: -100, y: 5000 }, DEFAULT_CANVAS_VIEWPORT);

    expect(mapped.x).toBeGreaterThanOrEqual(DEFAULT_PDF_VIEWPORT.marginX);
    expect(mapped.y).toBeLessThanOrEqual(DEFAULT_PDF_VIEWPORT.pageHeight - DEFAULT_PDF_VIEWPORT.marginTop);
    expect(mapped.y).toBeGreaterThanOrEqual(DEFAULT_PDF_VIEWPORT.marginBottom);
  });
});
