export type ReceiptInput = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

export async function readReceiptInputs(files: File[]): Promise<ReceiptInput[]> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );
}
