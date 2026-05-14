// ---------------------------------------------------------------------------
// /api/v1/watches/[id]/events — SSE stream of watch progress
// ---------------------------------------------------------------------------
//
// Mirrors /api/v1/runs/[id]/events. Public-read (phraseId IS the share
// credential), same-site + rate-limit gates apply, NO auth gate. Emits:
//   - `state`       on watch CRUD transitions (paused, resumed, archived)
//   - `observation` when an observation is recorded
//   - `alert`       on per-channel alert dispatch attempts (Week-3)
//   - `heartbeat`   every 30s
//
// Hard 5-min connection cap; honors Last-Event-ID for reconnect numbering.
// In Week-2 the SSE source flips from in-memory pub/sub to Worker SSE
// proxy + Supabase Realtime — the route shape stays identical.
// ---------------------------------------------------------------------------

import {
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../../lib/security/request-guards";
import { redactWatchForGet } from "../../../../../../lib/v1/redact";
import {
  getWatch,
  subscribeToWatch,
  type WatchEvent,
} from "../../../../../../lib/watch/store";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONNECTION_MS = 5 * 60_000;

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  // R2 SEC-M5 defense-in-depth: pin MIME-sniffing off, drop referrers.
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
    return jsonError("invalid watch id", 400);
  }

  const initial = getWatch(id);
  if (initial === null) {
    return jsonError("watch not found", 404);
  }

  // Reconnect support: clients echo back the last id they saw via the
  // standard `Last-Event-ID` request header. Resume the local id counter
  // from that value + 1. Clamped to [0, MAX_LAST_EVENT_ID] AND parsed
  // strictly (`/^\d+$/`) so a header like `1e20` or `99999999999999999999`
  // cannot push the local counter past `Number.MAX_SAFE_INTEGER` and
  // break monotonic event-id ordering (SEC-M4).
  const MAX_LAST_EVENT_ID = 1_000_000;
  const lastEventIdHeader = req.headers.get("last-event-id");
  const startFrom = (() => {
    if (lastEventIdHeader === null) {
      return 1;
    }
    if (!/^\d{1,8}$/.test(lastEventIdHeader)) {
      return 1;
    }
    const n = Number.parseInt(lastEventIdHeader, 10);
    if (!Number.isFinite(n) || n < 0 || n > MAX_LAST_EVENT_ID) {
      return 1;
    }

    return n + 1;
  })();

  let nextEventId = startFrom;
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let connectionTimer: ReturnType<typeof setTimeout> | null = null;
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
        if (unsubscribe !== null) {
          unsubscribe();
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // 1. Initial state event — redacted (operator address lists are
      //    PII; the phraseId is the share credential, not consent).
      send("state", redactWatchForGet(initial));

      // 2. Subscribe for transitions. `subscribeToWatch` returns `null`
      //    when either the per-watch cap (100) or the global cap (5000)
      //    is reached; the route emits one `error` event and closes.
      const sub = subscribeToWatch(id, (event: WatchEvent) => {
        if (event.kind === "state") {
          send("state", redactWatchForGet(event.record));
        } else if (event.kind === "observation") {
          send("observation", event.record);
        } else if (event.kind === "alert") {
          send("alert", {
            observationId: event.observationId,
            channel: event.channel,
            status: event.status,
          });
        }
      });
      if (sub === null) {
        send("error", { code: "subscriber-cap-reached" });
        cleanup();
        return;
      }
      unsubscribe = sub;

      // 3. Heartbeat — proxy + browser keep-alive.
      heartbeatTimer = setInterval(() => {
        send("heartbeat", { ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      // 4. Hard 5min cap — DoS protection.
      connectionTimer = setTimeout(cleanup, MAX_CONNECTION_MS);

      // 5. Client disconnect.
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
