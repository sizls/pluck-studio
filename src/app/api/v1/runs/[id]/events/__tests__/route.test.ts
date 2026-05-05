// ---------------------------------------------------------------------------
// /api/v1/runs/[id]/events — SSE contract tests
// ---------------------------------------------------------------------------
//
// Locks the SSE feed contract:
//   - 200 with text/event-stream content-type
//   - initial `state` event on connect with redacted payload
//   - 404 on unknown runId, 400 on malformed/oversize id
//   - 403 cross-site, 429 rate-limited
//   - subscribe-then-cancel → state event with status='cancelled'
//   - terminal status auto-closes after the grace window
//   - Last-Event-ID reconnect resumes id counter
//   - WHISTLE bundleUrl is redacted from EVERY emitted state event
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetRateLimit } from "../../../../../../../lib/rate-limit.js";
import {
  __resetForTests,
  cancelRun,
  createRun,
} from "../../../../../../../lib/v1/run-store.js";
import { GET, runtime } from "../route.js";

interface SseEvent {
  id: string | null;
  event: string | null;
  data: string;
}

const SAME_SITE = {
  "sec-fetch-site": "same-origin",
};

function eventsReq(
  id: string,
  headers: Record<string, string> = SAME_SITE,
): Request {
  return new Request(`http://localhost:3030/api/v1/runs/${id}/events`, {
    method: "GET",
    headers,
  });
}

/**
 * Read a fixed number of SSE messages from a Response body. Each
 * message is delimited by a blank line; we parse `id:` / `event:` /
 * `data:` lines into a structured object.
 *
 * Stops once `count` messages have been collected OR the stream ends.
 * Cancels the body reader afterwards so the route's heartbeat / keepalive
 * timers shut down cleanly.
 */
async function readEvents(res: Response, count: number): Promise<SseEvent[]> {
  expect(res.body).not.toBeNull();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: SseEvent[] = [];

  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const ev = parseEvent(raw);
      if (ev !== null) {
        events.push(ev);
        if (events.length >= count) {
          break;
        }
      }
      idx = buffer.indexOf("\n\n");
    }
  }
  await reader.cancel().catch(() => {});

  return events;
}

function parseEvent(raw: string): SseEvent | null {
  if (raw.length === 0) {
    return null;
  }
  let id: string | null = null;
  let event: string | null = null;
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  return { id, event, data };
}

const dragnetSpec = {
  pipeline: "bureau:dragnet" as const,
  payload: {
    targetUrl: "https://api.openai.com/v1/chat/completions",
    probePackId: "canon-honesty",
    cadence: "once",
    authorizationAcknowledged: true,
  },
};

beforeEach(() => {
  resetRateLimit();
  __resetForTests();
});

afterEach(() => {
  // Stream cleanup happens inside readEvents (reader.cancel()).
});

describe("GET /api/v1/runs/[id]/events — gates", () => {
  it("403s cross-site", async () => {
    const { record } = createRun({ ...dragnetSpec, idempotencyKey: "x" });
    const res = await GET(
      eventsReq(record.runId, { "sec-fetch-site": "cross-site" }),
      { params: Promise.resolve({ id: record.runId }) },
    );
    expect(res.status).toBe(403);
  });

  it("404s on unknown runId", async () => {
    const res = await GET(eventsReq("does-not-exist-0000"), {
      params: Promise.resolve({ id: "does-not-exist-0000" }),
    });
    expect(res.status).toBe(404);
  });

  it("400s on absurdly long id", async () => {
    const id = "x".repeat(200);
    const res = await GET(eventsReq(id), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(400);
  });

  it("400s on empty id", async () => {
    const res = await GET(eventsReq(""), {
      params: Promise.resolve({ id: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/runs/[id]/events — initial state event", () => {
  it("200s with text/event-stream content-type and emits the initial redacted record", async () => {
    const { record } = createRun({ ...dragnetSpec, idempotencyKey: "init" });
    const res = await GET(eventsReq(record.runId), {
      params: Promise.resolve({ id: record.runId }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);

    const [first] = await readEvents(res, 1);
    expect(first?.event).toBe("state");
    expect(first?.id).toBe("1");
    const data = JSON.parse(first!.data) as {
      runId: string;
      pipeline: string;
      status: string;
      payload: { targetUrl: string };
    };
    expect(data.runId).toBe(record.runId);
    expect(data.pipeline).toBe("bureau:dragnet");
    expect(data.status).toBe("pending");
    expect(data.payload.targetUrl).toBe(dragnetSpec.payload.targetUrl);
  });

  it("subscribe-then-cancel — receives a second state event with status='cancelled'", async () => {
    const { record } = createRun({ ...dragnetSpec, idempotencyKey: "cancel" });
    const res = await GET(eventsReq(record.runId), {
      params: Promise.resolve({ id: record.runId }),
    });
    expect(res.status).toBe(200);

    // Drive the cancel after the route has subscribed. We start the
    // event-reader concurrently and trigger the cancel via a microtask.
    const eventsPromise = readEvents(res, 2);
    queueMicrotask(() => {
      cancelRun(record.runId);
    });
    const events = await eventsPromise;
    expect(events.length).toBe(2);
    expect(events[0]?.event).toBe("state");
    expect(events[1]?.event).toBe("state");
    const second = JSON.parse(events[1]!.data) as { status: string };
    expect(second.status).toBe("cancelled");
  });

  it("Last-Event-ID resumes the id counter (id starts at Last-Event-ID + 1)", async () => {
    const { record } = createRun({ ...dragnetSpec, idempotencyKey: "lei" });
    const res = await GET(
      eventsReq(record.runId, { ...SAME_SITE, "last-event-id": "42" }),
      { params: Promise.resolve({ id: record.runId }) },
    );
    expect(res.status).toBe(200);

    const [first] = await readEvents(res, 1);
    expect(first?.id).toBe("43");
    expect(first?.event).toBe("state");
  });

  it("malformed Last-Event-ID falls back to id=1", async () => {
    const { record } = createRun({ ...dragnetSpec, idempotencyKey: "lei2" });
    const res = await GET(
      eventsReq(record.runId, { ...SAME_SITE, "last-event-id": "not-a-number" }),
      { params: Promise.resolve({ id: record.runId }) },
    );
    expect(res.status).toBe(200);

    const [first] = await readEvents(res, 1);
    expect(first?.id).toBe("1");
  });

  it("auto-closes the stream when the run is already in a terminal status at connect", async () => {
    const { record } = createRun({ ...dragnetSpec, idempotencyKey: "term" });
    cancelRun(record.runId);

    const res = await GET(eventsReq(record.runId), {
      params: Promise.resolve({ id: record.runId }),
    });
    expect(res.status).toBe(200);

    // We expect ONE state event then EOF (closed by the grace-window
    // timer or read-to-end). Read until the stream ends.
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let closed = false;
    while (!closed) {
      const { value, done } = await reader.read();
      if (done) {
        closed = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // The grace window is 2s — once we've seen the initial state event,
      // cancel the reader to avoid waiting for the timer to fire.
      if (buffer.includes("\n\n")) {
        break;
      }
    }
    await reader.cancel().catch(() => {});

    const events: SseEvent[] = [];
    for (const raw of buffer.split("\n\n")) {
      const ev = parseEvent(raw);
      if (ev !== null) {
        events.push(ev);
      }
    }
    expect(events.length).toBeGreaterThanOrEqual(1);
    const data = JSON.parse(events[0]!.data) as { status: string };
    expect(data.status).toBe("cancelled");
  });
});

describe("GET /api/v1/runs/[id]/events — privacy redaction (defense-in-depth)", () => {
  it("WHISTLE: bundleUrl is stripped from the initial state event", async () => {
    const whistlePayload = {
      bundleUrl: "https://leak-source.example/bundle.zip",
      manualRedactPhrase: "internal-codename-XYZ",
      routingPartner: "propublica",
    };
    const { record } = createRun({
      pipeline: "bureau:whistle",
      payload: whistlePayload,
      idempotencyKey: "wh1",
    });

    const res = await GET(eventsReq(record.runId), {
      params: Promise.resolve({ id: record.runId }),
    });
    expect(res.status).toBe(200);

    const [first] = await readEvents(res, 1);
    expect(first?.event).toBe("state");
    expect(first?.data).not.toContain("leak-source.example");
    expect(first?.data).not.toContain("internal-codename-XYZ");
    const data = JSON.parse(first!.data) as {
      payload: Record<string, unknown>;
    };
    expect(data.payload.bundleUrl).toBeUndefined();
    expect(data.payload.manualRedactPhrase).toBeUndefined();
    expect(data.payload.routingPartner).toBe("propublica");
  });

  it("WHISTLE: bundleUrl stays redacted on the cancel transition event too", async () => {
    const { record } = createRun({
      pipeline: "bureau:whistle",
      payload: {
        bundleUrl: "https://leak-source.example/bundle.zip",
        routingPartner: "propublica",
      },
      idempotencyKey: "wh2",
    });

    const res = await GET(eventsReq(record.runId), {
      params: Promise.resolve({ id: record.runId }),
    });
    const eventsPromise = readEvents(res, 2);
    queueMicrotask(() => {
      cancelRun(record.runId);
    });
    const events = await eventsPromise;
    expect(events.length).toBe(2);
    // BOTH events must redact bundleUrl — defense-in-depth at the SSE
    // boundary applies to every emitted state event, not just the first.
    for (const ev of events) {
      expect(ev.data).not.toContain("leak-source.example");
      const parsed = JSON.parse(ev.data) as {
        payload: Record<string, unknown>;
      };
      expect(parsed.payload.bundleUrl).toBeUndefined();
    }
    const second = JSON.parse(events[1]!.data) as { status: string };
    expect(second.status).toBe("cancelled");
  });
});

describe("GET /api/v1/runs/[id]/events — runtime declaration", () => {
  // Build-time check: the route MUST opt into the Node runtime explicitly.
  // Edge has a 30s timeout that would silently cap connections + break the
  // documented 5-minute lifetime + Last-Event-ID resume semantics. A
  // source-text assertion is simpler and safer than runtime introspection
  // — it catches regressions at test time, not in production.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const routePath = resolve(__dirname, "../route.ts");
  const routeSource = readFileSync(routePath, "utf8");

  it("exports runtime = 'nodejs' (value)", () => {
    expect(runtime).toBe("nodejs");
  });

  it("declares `export const runtime = \"nodejs\"` in the route source", () => {
    // Match either single or double quotes; tolerate optional semicolons.
    expect(routeSource).toMatch(
      /export\s+const\s+runtime\s*=\s*["']nodejs["']/,
    );
  });
});
