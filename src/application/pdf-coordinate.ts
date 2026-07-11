import type { StrokePoint } from "./stroke.port";

export type PdfViewport = {
  pageWidth: number;
  pageHeight: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
};

export type CanvasViewport = {
  width: number;
  height: number;
};

export const DEFAULT_PDF_VIEWPORT: PdfViewport = {
  pageWidth: 595,
  pageHeight: 842,
  marginX: 72,
  marginTop: 52,
  marginBottom: 72
};

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = {
  width: 1024,
  height: 1365
};

export function mapCanvasPointToPdf(
  point: StrokePoint,
  canvas: CanvasViewport,
  pdfViewport: PdfViewport = DEFAULT_PDF_VIEWPORT
): StrokePoint {
  const contentWidth = pdfViewport.pageWidth - pdfViewport.marginX * 2;
  const topY = pdfViewport.pageHeight - pdfViewport.marginTop;
  const bottomY = pdfViewport.marginBottom;
  const contentHeight = topY - bottomY;

  const normalizedX = clamp(point.x / canvas.width, 0, 1);
  const normalizedY = clamp(point.y / canvas.height, 0, 1);

  return {
    x: pdfViewport.marginX + normalizedX * contentWidth,
    y: topY - normalizedY * contentHeight
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
