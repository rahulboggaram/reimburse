declare module "sharp" {
  const sharp: (input: Buffer, options?: { failOn?: string }) => {
    rotate: () => {
      resize: (
        width: number,
        height: number,
        options: { fit: string; withoutEnlargement: boolean },
      ) => {
        jpeg: (options?: { quality?: number; mozjpeg?: boolean }) => {
          toBuffer: () => Promise<Buffer>;
        };
      };
    };
  };
  export default sharp;
}
