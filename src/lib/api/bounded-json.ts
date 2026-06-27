// ---------------------------------------------------------------------------
// Pluck / shared bounded JSON body reader
// ---------------------------------------------------------------------------
//
// Every POST/PATCH route on Studio caps the request body BEFORE auth +
// validation: a 100MB payload should be rejected via Content-Length
// inspection (microseconds) rather than burning JSON-parse cycles.
//
// 64 KiB is generous for every Studio activation flow — the typical
// shape is a few URLs, a few booleans, a content hash, and an
// authorization-ack. v1/runs payloads ride the same envelope and stay
// well under the cap.
//
// SECURITY POSTURE
//   - The Content-Length check is best-effort. Clients can lie about it
//     (or omit it). The follow-up `await req.json()` still completes,
//     which gives the runtime a second chance to reject pathological
//     bodies that omit Content-Length. A real edge limiter (Vercel,
//     Cloudflare) enforces hard byte limits upstream — this gate is
//     defense-in-depth, not the sole boundary.
//   - We return distinct error codes so SDK retry layers can
//     distinguish "you sent too much" (413, no retry) from "your JSON
//     was malformed" (400, no retry) from a happy-path success.
// ---------------------------------------------------------------------------

export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; status: 400 | 413 };

export async function readBoundedJson(
  req: Request,
  maxBytes: number = MAX_REQUEST_BODY_BYTES,
): Promise<BoundedJsonResult> {
  const lenHeader = req.headers.get("content-length");
  if (lenHeader !== null) {
    const len = Number.parseInt(lenHeader, 10);
    if (Number.isFinite(len) && len > maxBytes) {
      return { ok: false, error: "request body too large", status: 413 };
    }
  }
  try {
    return { ok: true, value: await req.json() };
  } catch {
    return { ok: false, error: "invalid JSON body", status: 400 };
  }
}
