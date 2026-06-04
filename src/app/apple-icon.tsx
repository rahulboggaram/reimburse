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
          background: "#022c22",
          borderRadius: 40,
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 14,
            background: "#d97706",
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 700,
            color: "#ecfdf5",
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
