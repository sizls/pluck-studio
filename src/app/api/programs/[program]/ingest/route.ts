// ---------------------------------------------------------------------------
// Pluck ingestion endpoint — placeholder until persistence wires in
// ---------------------------------------------------------------------------
//
// Each program (DRAGNET, NUCLEI, etc.) accepts dossier updates from
// quorum-node operators via POST /api/programs/<program>/ingest. The
// placeholder returns 501 — the persistence + auth wiring lands with
// the first program ingestion (DRAGNET) so we know what real
// ingestion traffic looks like before hardening the endpoint.
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
      note: "The first program ingestion (DRAGNET) wires this endpoint with auth, persistence, and quorum-vote acceptance. Until then, operators run Pluck programs locally.",
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
    accepts: "POST /api/programs/<program>/ingest",
  });
}
