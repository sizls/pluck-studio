// ---------------------------------------------------------------------------
// /bureau/dragnet/runs/[id]/opengraph-image — auto-generated 1200×630 PNG
// ---------------------------------------------------------------------------
//
// Every paste of a receipt URL into Slack / X / Discord / iMessage now
// auto-unfurls into a self-marketing card. The phrase ID is the
// headline; the cycle status is the subhead. When the receipt is
// anchored and contradictions exist, the card promotes them — turning
// the receipt URL into receipt-as-weapon.
//
// Today this is a stub: real classification counts come from the runner
// when /v1/runs lands. Until then, the card shows phrase ID + status —
// already a meaningful upgrade over the default "Pluck Studio" preview.
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";

import {
  isPhraseId,
  vendorSlugFromUrl,
} from "../../../../../lib/phrase-id";

export const runtime = "edge";
export const alt = "DRAGNET cycle receipt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgProps {
  params: Promise<{ id: string }>;
}

const FG = "#e4dccd";
const FG_DIM = "#888273";
const BG = "#1a1a1a";
const ACCENT = "#a3201d";

function vendorFromPhrase(id: string): string | null {
  // For scoped phrase IDs (`vendor-adj-noun-NNNN`), the first segment is
  // the vendor slug. Bare phrase IDs (R1) had no vendor, so we punt.
  const parts = id.split("-");
  if (parts.length === 4 && /^[a-z0-9]+$/.test(parts[0] ?? "")) {
    return parts[0] ?? null;
  }
  return null;
}

export default async function Image({ params }: OgProps): Promise<Response> {
  const { id } = await params;
  const isPhrase = isPhraseId(id);
  const vendor = isPhrase ? vendorFromPhrase(id) : null;

  // The vendor slug is also derivable from the URL via vendorSlugFromUrl,
  // but on a receipt page we already have the phrase ID. Both should
  // resolve to the same answer for round-trip integrity.
  void vendorSlugFromUrl;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: FG,
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: FG_DIM,
            fontSize: 24,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: ACCENT }}>●</span>
          <span style={{ marginLeft: 16 }}>Pluck Bureau · DRAGNET</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {vendor !== null ? (
            <div
              style={{
                fontSize: 36,
                color: FG_DIM,
                marginBottom: 12,
                letterSpacing: "0.04em",
              }}
            >
              Probe of <strong style={{ color: FG }}>{vendor}</strong>
            </div>
          ) : null}
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              wordBreak: "break-all",
              color: FG,
            }}
          >
            {id}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: FG_DIM,
              letterSpacing: "0.06em",
            }}
          >
            cycle pending — anchored to Sigstore Rekor on completion
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: FG_DIM,
            fontSize: 20,
          }}
        >
          <span>studio.pluck.run</span>
          <span style={{ letterSpacing: "0.08em" }}>
            tamper-evident · offline-verifiable · forever
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
