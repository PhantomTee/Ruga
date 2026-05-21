import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ruga — Bet on the Rug";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#FF1515",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px 90px",
          fontFamily: "Impact, 'Arial Black', sans-serif",
          position: "relative"
        }}
      >
        {/* Top bar line */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          <div style={{ width: 6, height: 6, background: "#000", borderRadius: "50%" }} />
          <span style={{ fontFamily: "monospace", fontSize: 18, color: "#00000088", letterSpacing: 4 }}>
            PREDICTION MARKETS
          </span>
        </div>

        {/* Big RUGA */}
        <div style={{ fontSize: 220, color: "#000000", lineHeight: 0.85, fontWeight: 900 }}>
          RUGA
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 64, color: "#000000", marginTop: 28, fontWeight: 900 }}>
          BET ON THE RUG.
        </div>

        {/* Description */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 26,
            color: "#00000077",
            marginTop: 28,
            maxWidth: 700
          }}
        >
          AI flags blacklisted tokens. You bet whether they rug within 7 days.
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 50, height: 4, background: "#000" }} />
            <span style={{ fontFamily: "monospace", fontSize: 22, color: "#000000aa" }}>
              ruga-app.vercel.app
            </span>
          </div>
          <div
            style={{
              background: "#000",
              color: "#FF1515",
              padding: "12px 28px",
              fontSize: 22,
              fontFamily: "monospace",
              letterSpacing: 2
            }}
          >
            ARC TESTNET
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
