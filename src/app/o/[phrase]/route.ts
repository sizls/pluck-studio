// ---------------------------------------------------------------------------
// GET /o/<phrase> — Phrase-ID Speed-Dial (short-form alias)
// ---------------------------------------------------------------------------
//
// Type-impatient operator alias. Behavior identical to /open/<phrase>
// — same redirect target, same cache headers, same fallback semantics.
// The shared resolver lives in `src/lib/speed-dial.ts`; this route is
// a thin export that re-uses the /open handler so behavior cannot
// drift between the two surfaces.
//
// Pasting `/o/swift-falcon-3742` into the URL bar from muscle memory
// resolves the same way as `/open/swift-falcon-3742` — by design.
// ---------------------------------------------------------------------------

export { GET } from "../../open/[phrase]/route.js";
