import { ImageResponse } from "next/og";

/** Home-screen icon for iPhone and iPad: the Flipper ball on navy. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#00175f" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="15" fill="#ffc700" />
          <path
            d="M9 4.5c5 6.5 5 16.5 0 23M23 4.5c-5 6.5-5 16.5 0 23"
            fill="none"
            stroke="#00175f"
            strokeWidth="1.6"
            strokeDasharray="2 1.6"
          />
        </svg>
      </div>
    ),
    size,
  );
}
