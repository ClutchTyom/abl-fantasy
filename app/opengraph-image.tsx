import { ImageResponse } from "next/og";

export const alt = "ABL Fantasy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Шрифт по умолчанию в ImageResponse не содержит кириллицу,
// поэтому на картинке только латиница.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ee3c3e 0%, #da1315 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -4 }}>
          ABL Fantasy
        </div>
        <div style={{ fontSize: 44, marginTop: 24, opacity: 0.9 }}>
          Amateur Basketball League
        </div>
      </div>
    ),
    { ...size }
  );
}
