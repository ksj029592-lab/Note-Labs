type BlockBlobClientLike = {
  uploadData(
    data: Buffer,
    options?: { blobHTTPHeaders?: { blobContentType?: string } }
  ): Promise<unknown>;
  url: string;
};

type ContainerClientLike = {
  getBlockBlobClient(blobName: string): BlockBlobClientLike;
};

import type { SavePdfInput, SavePdfResult } from "../../application/pdf-storage.port";

export class AzureBlobPdfStorage {
  constructor(
    private readonly containerClient: ContainerClientLike,
    private readonly now: () => number = () => Date.now()
  ) {}

  async savePdf(input: SavePdfInput): Promise<SavePdfResult> {
    const blobName = `${input.noteId}/${this.now()}.pdf`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(input.bytes, {
      blobHTTPHeaders: {
        blobContentType: "application/pdf"
      }
    });

    return {
      blobName,
      url: blockBlobClient.url
    };
  }
}
