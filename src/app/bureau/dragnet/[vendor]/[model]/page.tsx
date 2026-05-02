// ---------------------------------------------------------------------------
// Bureau / DRAGNET / [vendor] / [model] – per-target timeline
// ---------------------------------------------------------------------------
//
// Phase 1 alpha. Renders a placeholder dossier built locally so the
// page works before the Kite-backed ingestion API is wired. Once the
// /api/bureau/dragnet/ingest endpoint goes live (Phase 1.5+), this
// page reads from the persisted dossier index.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import {
  appendDot,
  buildDossier,
  computeDotId,
} from "@sizls/pluck-bureau-core";
import type { Dossier, TimelineDot } from "@sizls/pluck-bureau-core";
import { DossierViewer } from "@/components/bureau-ui";

interface PageProps {
  params: Promise<{ vendor: string; model: string }>;
}

export default async function DragnetTimelinePage({
  params,
}: PageProps): Promise<ReactNode> {
  const { vendor, model } = await params;
  const dossier = buildPlaceholderDossier(vendor, model);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">
          dragnet · {vendor}/{model}
        </h1>
        <p className="bureau-hero-tagline">
          Phase 1 alpha — this dossier is placeholder data. Live timelines
          ship with the Kite-backed ingestion API in Phase 1.5.
        </p>
      </section>
      <DossierViewer dossier={dossier} />
    </>
  );
}

function buildPlaceholderDossier(vendor: string, model: string): Dossier {
  let dossier = buildDossier({
    program: "dragnet",
    subject: { vendor, model },
    dots: [],
  });
  const baseTime = Date.UTC(2026, 0, 1, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const tone =
      i % 7 === 0 ? "red" : i % 11 === 0 ? "black" : "green";
    const prevDotId =
      dossier.dots.length > 0
        ? dossier.dots[dossier.dots.length - 1]!.dotId
        : undefined;
    const partial: Omit<TimelineDot, "dotId"> = {
      schemaVersion: 1,
      program: "dragnet",
      tone,
      ...(prevDotId !== undefined ? { prevDotId } : {}),
      rekorUuid: `placeholder-${i.toString().padStart(64, "0").slice(-64)}`,
      subject: { vendor, model },
      envelopeHash: `${i.toString(16).padStart(64, "0").slice(-64)}`,
      emittedAt: new Date(baseTime + i * 60_000).toISOString(),
      reason: tone === "red" ? "contradict:placeholder" : "clean",
      summary: `cycle ${i} (placeholder data)`,
    };
    const dotId = computeDotId(partial);
    dossier = appendDot(dossier, { ...partial, dotId });
  }

  return dossier;
}
