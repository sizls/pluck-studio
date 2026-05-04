import { ImageResponse } from "next/og";

import { isPhraseId, isUuid, vendorFromPhrase } from "../../../../../lib/phrase-id";

export const runtime = "edge";
export const alt = "MOLE canary seal receipt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgProps { params: Promise<{ id: string }>; }

const FG = "#e4dccd";
const FG_DIM = "#888273";
const BG = "#1a1a1a";
const ACCENT = "#a78a1f"; // MOLE yellow — sealed-canary signal

const MAX_ID_LENGTH = 64;

function renderPlaceholder(): Response {
  return new ImageResponse(
    (<div style={{ width: "100%", height: "100%", background: BG, color: FG_DIM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "ui-monospace, monospace", fontSize: 36, letterSpacing: "0.08em" }}>Pluck Bureau · MOLE</div>),
    { ...size },
  );
}

function headlineFontSize(id: string): number {
  if (id.length <= 24) return 84;
  if (id.length <= 30) return 72;
  if (id.length <= 40) return 60;
  return 44;
}

export default async function Image({ params }: OgProps): Promise<Response> {
  const { id } = await params;
  if (id.length === 0 || id.length > MAX_ID_LENGTH) return renderPlaceholder();
  if (!isPhraseId(id) && !isUuid(id)) return renderPlaceholder();
  const canary = vendorFromPhrase(id);
  const fontSize = headlineFontSize(id);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: BG, color: FG, display: "flex", flexDirection: "column", padding: "60px 80px", fontFamily: "ui-monospace, monospace" }}>
        <div style={{ display: "flex", alignItems: "center", color: FG_DIM, fontSize: 24, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span style={{ color: ACCENT }}>●</span>
          <span style={{ marginLeft: 16 }}>Pluck Bureau · MOLE</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          {canary !== null ? (
            <div style={{ fontSize: 36, color: FG_DIM, marginBottom: 12, letterSpacing: "0.04em" }}>
              Canary <strong style={{ color: FG }}>{canary}</strong>
            </div>
          ) : null}
          <div style={{ fontSize, fontWeight: 700, lineHeight: 1.05, wordBreak: "break-word", color: FG }}>{id}</div>
          <div style={{ marginTop: 28, fontSize: 28, color: FG_DIM, letterSpacing: "0.06em" }}>
            seal pending — Rekor timestamp predates any probe-run on completion
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: FG_DIM, fontSize: 20 }}>
          <span>studio.pluck.run</span>
          <span style={{ letterSpacing: "0.08em" }}>seal first · canary body stays operator-side · NYT-vs-OpenAI as a public service</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
