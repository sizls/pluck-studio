import type { ReactNode } from "react";

interface MonitorParams {
  params: Promise<{ name: string }>;
}

export default async function MonitorDetailPage({
  params,
}: MonitorParams): Promise<ReactNode> {
  const { name } = await params;

  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title">Monitor: {name}</h1>
        <p className="studio-hero-tagline">
          Public profile for a quorum-node operator. Phase 0 — placeholder.
          Phase 1 wires this to the operator-identity registry.
        </p>
      </section>
    </>
  );
}
