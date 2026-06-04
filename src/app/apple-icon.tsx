import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #f8e9b8 0%, #d4af37 45%, #9a7b0a 100%)",
          borderRadius: 40,
        }}
      />
    ),
    { ...size },
  );
}
