// ---------------------------------------------------------------------------
// Bureau ingestion endpoint – Phase 0 placeholder
// ---------------------------------------------------------------------------
//
// Each program (DRAGNET, NUCLEI, etc.) accepts dossier updates from
// quorum-node operators via POST /api/bureau/<program>/ingest. Phase 0
// returns 501 – the persistence + auth wiring lands with Phase 1
// (DRAGNET) so we know what real ingestion traffic looks like before
// hardening the endpoint.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ program: string }>;
}

export async function POST(
  _req: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { program } = await params;

  return NextResponse.json(
    {
      error: "ingest endpoint not yet wired",
      program,
      phase: "phase-0",
      note: "Phase 1 (DRAGNET) wires this endpoint with auth, persistence, and quorum-vote acceptance. Until then, operators run bureau programs locally.",
    },
    { status: 501 },
  );
}

export async function GET(
  _req: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { program } = await params;

  return NextResponse.json({
    program,
    phase: "phase-0",
    accepts: "POST /api/bureau/<program>/ingest",
  });
}
