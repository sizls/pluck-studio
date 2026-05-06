import { ImageResponse } from "next/og";

import { isPhraseId, isUuid, vendorFromPhrase } from "../../../../../lib/phrase-id";

export const runtime = "edge";
export const alt = "SBOM-AI provenance attestation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgProps { params: Promise<{ id: string }>; }

const FG = "#e4dccd";
const FG_DIM = "#888273";
const BG = "#1a1a1a";
const ACCENT = "#3a7aa3"; // SBOM-AI blue — supply-chain signal

const MAX_ID_LENGTH = 64;

function renderPlaceholder(): Response {
  return new ImageResponse(
    (<div style={{ width: "100%", height: "100%", background: BG, color: FG_DIM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "ui-monospace, monospace", fontSize: 36, letterSpacing: "0.08em" }}>Pluck Bureau · SBOM-AI</div>),
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
  // TODO(sigil): integrate <PhraseSigil renderPhraseSigil() bytes /> into the OG image
  // once edge runtime supports inline SVG composition. The sigil is the canonical
  // visual identity for every phrase ID — see src/lib/sigil/phrase-sigil.ts. Wiring
  // here means social-share unfurls (Slack/X/iMessage) carry the sigil too.
  const { id } = await params;
  if (id.length === 0 || id.length > MAX_ID_LENGTH) return renderPlaceholder();
  if (!isPhraseId(id) && !isUuid(id)) return renderPlaceholder();
  const kind = vendorFromPhrase(id);
  const fontSize = headlineFontSize(id);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: BG, color: FG, display: "flex", flexDirection: "column", padding: "60px 80px", fontFamily: "ui-monospace, monospace" }}>
        <div style={{ display: "flex", alignItems: "center", color: FG_DIM, fontSize: 24, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span style={{ color: ACCENT }}>●</span>
          <span style={{ marginLeft: 16 }}>Pluck Bureau · SBOM-AI</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          {kind !== null ? (
            <div style={{ fontSize: 36, color: FG_DIM, marginBottom: 12, letterSpacing: "0.04em" }}>
              Provenance for <strong style={{ color: FG }}>{kind}</strong>
            </div>
          ) : null}
          <div style={{ fontSize, fontWeight: 700, lineHeight: 1.05, wordBreak: "break-word", color: FG }}>{id}</div>
          <div style={{ marginTop: 28, fontSize: 28, color: FG_DIM, letterSpacing: "0.06em" }}>
            publish pending — Rekor-logged on success
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: FG_DIM, fontSize: 20 }}>
          <span>studio.pluck.run</span>
          <span style={{ letterSpacing: "0.08em" }}>canonical-JSON · DSSE-signed · cosign-interop</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
