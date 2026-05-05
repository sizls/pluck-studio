// ---------------------------------------------------------------------------
// GET /api/v1/runs/[id]/events — Server-Sent Events stream of run progress
// ---------------------------------------------------------------------------
//
// SSE feed for a single run. The first event on connect is a `state`
// event carrying the current redacted RunRecord; every subsequent state
// transition (today: cancel-via-DELETE → status=cancelled) publishes
// another `state` event. A `heartbeat` event fires every 30s to keep
// the connection alive through reverse proxies + idle-connection killers.
// On terminal status (anchored | failed | cancelled) the stream emits
// the final event and closes after a 2s grace window so the last event
// definitely reaches the client.
//
// SECURITY POSTURE — same as `GET /api/v1/runs/[id]`:
//   - same-site (CSRF) gate
//   - rate-limit gate
//   - NO auth gate — the phraseId in the URL IS the share credential
//     (the "Google Docs share link" model)
//
// PRIVACY: every emitted state event runs through `redactPayloadForGet`
// — defense-in-depth at the SSE boundary. WHISTLE.bundleUrl,
// ROTATE.operatorNote, etc. NEVER appear in either the initial event
// or any subsequent transition event.
//
// LIMITS (DoS / memory protection):
//   - Hard 5-minute connection cap — auto-close even without a terminal
//     status. Prevents zombie connections from piling up.
//   - 100 subscribers per runId enforced by the run-store. Past the cap
//     we 503 instead of silently dropping events.
//
// RECONNECT: honors `Last-Event-ID`. We don't replay history (the stub
// has no event log) — instead we restart the local id counter from
// `Last-Event-ID + 1` so the initial state event on reconnect carries
// a strictly-increasing id. Real backend (Supabase + Realtime) replaces
// this with channel-replay semantics.
//
// BACKEND-SWAP MAPPING: this route's `subscribeToRun` call maps to a
// `runs:id=eq.<runId>` Supabase Realtime channel subscription. The
// route shape, headers, event types, and Last-Event-ID semantics stay
// stable across the swap.
// ---------------------------------------------------------------------------

import {
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../../lib/security/request-guards";
import { redactPayloadForGet } from "../../../../../../lib/v1/redact";
import {
  getRun,
  subscribeToRun,
} from "../../../../../../lib/v1/run-store";
import type { RunRecord, RunStatus } from "../../../../../../lib/v1/run-spec";

// ---------------------------------------------------------------------------
// SSE requires the Node runtime — Edge has a 30s timeout that would silently
// cap connections + break the documented 5-minute lifetime + Last-Event-ID
// resume semantics. Explicit declaration prevents accidental future
// regression to Edge.
// ---------------------------------------------------------------------------
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONNECTION_MS = 5 * 60_000;
const TERMINAL_GRACE_MS = 2_000;

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "anchored",
  "failed",
  "cancelled",
]);

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  // Disable nginx response buffering so events flush immediately.
  "X-Accel-Buffering": "no",
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeView(record: RunRecord): RunRecord {
  return {
    ...record,
    payload: redactPayloadForGet(record.pipeline, record.payload),
  };
}

export async function GET(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isSameSiteRequest(req)) {
    return jsonError("cross-site request rejected", 403);
  }
  if (!rateLimitOk(req)) {
    return jsonError(
      "too many requests — slow down and try again in a minute",
      429,
    );
  }

  const { id } = await context.params;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return jsonError("invalid run id", 400);
  }

  const initialRecord = getRun(id);
  if (initialRecord === null) {
    return jsonError("run not found", 404);
  }

  // Reconnect support: clients echo back the last id they saw via the
  // standard `Last-Event-ID` request header. Resume the local id counter
  // from that value + 1. Anything non-numeric / negative falls back to 1.
  const lastEventIdHeader = req.headers.get("last-event-id");
  const startFrom = (() => {
    if (lastEventIdHeader === null) {
      return 1;
    }
    const n = Number(lastEventIdHeader);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return 1;
    }

    return n + 1;
  })();

  let nextEventId = startFrom;
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let connectionTimer: ReturnType<typeof setTimeout> | null = null;
  let terminalTimer: ReturnType<typeof setTimeout> | null = null;
  // Hoisted so both `start` and `cancel` can call the same teardown path
  // — single source of truth for cleanup. Assigned inside `start`, where
  // we close over the stream controller.
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown): void => {
        if (closed) {
          return;
        }
        const payload = `id: ${nextEventId++}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller already closed (client disconnect raced with
          // setInterval / publish). Mark closed so subsequent sends
          // become no-ops.
          closed = true;
        }
      };

      cleanup = (): void => {
        if (closed) {
          return;
        }
        closed = true;
        if (heartbeatTimer !== null) {
          clearInterval(heartbeatTimer);
        }
        if (connectionTimer !== null) {
          clearTimeout(connectionTimer);
        }
        if (terminalTimer !== null) {
          clearTimeout(terminalTimer);
        }
        if (unsubscribe !== null) {
          unsubscribe();
        }
        try {
          controller.close();
        } catch {
          // Already closed by the runtime — fine.
        }
      };

      // 1. Initial state event — current snapshot, redacted.
      send("state", safeView(initialRecord));

      // If the run is ALREADY in a terminal status at connect time,
      // emit + close after the grace window. No need to subscribe.
      if (TERMINAL_STATUSES.has(initialRecord.status)) {
        terminalTimer = setTimeout(cleanup, TERMINAL_GRACE_MS);
        return;
      }

      // 2. Subscribe for future state transitions. Wrap the call in a
      //    try/catch — `subscribeToRun` throws if the per-run subscriber
      //    cap is reached (memory protection). On overflow we close
      //    the controller cleanly; a pre-stream 503 can't be sent
      //    once the response headers are out the door.
      try {
        unsubscribe = subscribeToRun(id, (record) => {
          send("state", safeView(record));
          if (TERMINAL_STATUSES.has(record.status)) {
            // Grace window so the final event reaches the client
            // before we close the connection. Clear any prior terminal
            // timer first — back-to-back terminal events are impossible
            // today but possible with a future runner that emits
            // multiple terminal-status updates. Idempotent assignment
            // prevents leaked timers.
            if (terminalTimer !== null) {
              clearTimeout(terminalTimer);
            }
            terminalTimer = setTimeout(cleanup, TERMINAL_GRACE_MS);
          }
        });
      } catch {
        // Cap exceeded — emit one error event the client can react to,
        // then close.
        send("error", { code: "subscriber-cap-reached" });
        cleanup();
        return;
      }

      // 3. Heartbeat — keeps proxies + the browser EventSource alive.
      heartbeatTimer = setInterval(() => {
        send("heartbeat", { ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      // 4. Hard connection cap — DoS protection. Auto-close at 5min
      //    even without a terminal status.
      connectionTimer = setTimeout(cleanup, MAX_CONNECTION_MS);

      // 5. Client disconnect → cleanup. Next.js wires `req.signal` to
      //    the underlying connection.
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      // ReadableStream.cancel is invoked when the consumer pulls the
      // plug (e.g. response.body.getReader().cancel()). Delegate to
      // cleanup() — single source of truth for teardown so the two
      // paths can't drift.
      cleanup();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
