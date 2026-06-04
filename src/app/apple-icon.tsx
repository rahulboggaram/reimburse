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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#d97706",
          borderRadius: 40,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 700,
            color: "#022c22",
            marginTop: -6,
          }}
        >
          R
        </div>
      </div>
    ),
    { ...size },
  );
}
