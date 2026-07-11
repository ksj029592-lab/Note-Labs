export type SavePdfInput = {
  noteId: string;
  bytes: Buffer;
};

export type SavePdfResult = {
  blobName: string;
  url: string;
};

export interface PdfStoragePort {
  savePdf(input: SavePdfInput): Promise<SavePdfResult>;
}
