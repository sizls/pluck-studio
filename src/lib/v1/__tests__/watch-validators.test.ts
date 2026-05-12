// ---------------------------------------------------------------------------
// watch-validators — unit tests for WatchSpec/WatchUpdate validation
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  validateWatchSpec,
  validateWatchUpdate,
  WATCH_LIMITS,
} from "../watch-validators.js";

const validChannels = {
  dashboard: true,
  email: [],
  webhook: [],
  slack: [],
  phraseId: true,
};

const validSpec = {
  name: "OpenAI pricing watch",
  url: "https://openai.com/pricing",
  cron: "@daily",
  intent:
    "Alert when GPT-4 input token price changes from its current value, especially on the API pricing table near the top.",
  fetcherKind: "playwright",
  autonomyMode: "diff-gated",
  alertChannels: validChannels,
};

describe("validateWatchSpec — happy path", () => {
  it("accepts a fully-formed body", () => {
    const r = validateWatchSpec(validSpec);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.name).toBe(validSpec.name);
      expect(r.spec.cron).toBe("@daily");
      expect(r.spec.alertChannels.dashboard).toBe(true);
    }
  });

  it("accepts optional fields", () => {
    const r = validateWatchSpec({
      ...validSpec,
      confidenceThreshold: 0.9,
      diffThreshold: 0.05,
      ignoreSelectors: [".banner", "#cookie-notice"],
      useVisionDefault: true,
      dailyBudgetUsd: 5.0,
      idempotencyKey: "watch-1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.confidenceThreshold).toBe(0.9);
      expect(r.spec.useVisionDefault).toBe(true);
      expect(r.spec.idempotencyKey).toBe("watch-1");
    }
  });
});

describe("validateWatchSpec — envelope rejection", () => {
  it("rejects non-objects", () => {
    expect(validateWatchSpec(null).ok).toBe(false);
    expect(validateWatchSpec("hello").ok).toBe(false);
    expect(validateWatchSpec([1, 2, 3]).ok).toBe(false);
  });

  it("rejects unknown top-level keys", () => {
    const r = validateWatchSpec({ ...validSpec, unknownField: 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/unknownField/);
    }
  });
});

describe("validateWatchSpec — URL guard", () => {
  it("rejects localhost", () => {
    expect(
      validateWatchSpec({ ...validSpec, url: "http://localhost/foo" }).ok,
    ).toBe(false);
  });
  it("rejects RFC1918 IPs", () => {
    expect(
      validateWatchSpec({ ...validSpec, url: "http://10.0.0.1/" }).ok,
    ).toBe(false);
    expect(
      validateWatchSpec({ ...validSpec, url: "http://192.168.1.1/" }).ok,
    ).toBe(false);
    expect(
      validateWatchSpec({ ...validSpec, url: "http://172.16.0.1/" }).ok,
    ).toBe(false);
  });
  it("rejects non-http(s) schemes", () => {
    expect(
      validateWatchSpec({ ...validSpec, url: "ftp://example.com/" }).ok,
    ).toBe(false);
  });
});

describe("validateWatchSpec — cron", () => {
  it("accepts @-macros", () => {
    expect(validateWatchSpec({ ...validSpec, cron: "@hourly" }).ok).toBe(true);
  });
  it("accepts 5-field cron", () => {
    expect(
      validateWatchSpec({ ...validSpec, cron: "*/15 * * * *" }).ok,
    ).toBe(true);
  });
  it("rejects gibberish", () => {
    expect(validateWatchSpec({ ...validSpec, cron: "every minute" }).ok).toBe(
      false,
    );
  });
});

describe("validateWatchSpec — intent length", () => {
  it("rejects too-short intent", () => {
    expect(validateWatchSpec({ ...validSpec, intent: "watch it" }).ok).toBe(
      false,
    );
  });

  it("rejects too-long intent", () => {
    const longIntent = "a".repeat(WATCH_LIMITS.intentMax + 1);
    expect(validateWatchSpec({ ...validSpec, intent: longIntent }).ok).toBe(
      false,
    );
  });
});

describe("validateWatchSpec — autonomy + fetcher enums", () => {
  it("rejects unknown autonomyMode", () => {
    expect(
      validateWatchSpec({ ...validSpec, autonomyMode: "yolo" }).ok,
    ).toBe(false);
  });

  it("rejects unknown fetcherKind", () => {
    expect(
      validateWatchSpec({ ...validSpec, fetcherKind: "selenium" }).ok,
    ).toBe(false);
  });
});

describe("validateWatchSpec — alertChannels", () => {
  it("rejects when no channel is enabled", () => {
    const r = validateWatchSpec({
      ...validSpec,
      alertChannels: {
        dashboard: false,
        email: [],
        webhook: [],
        slack: [],
        phraseId: false,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/at least one channel/);
    }
  });

  it("rejects invalid email format", () => {
    const r = validateWatchSpec({
      ...validSpec,
      alertChannels: {
        ...validChannels,
        email: ["not-an-email"],
      },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects http:// webhook URLs (https required)", () => {
    const r = validateWatchSpec({
      ...validSpec,
      alertChannels: {
        ...validChannels,
        webhook: ["http://hooks.example.com/x"],
      },
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateWatchUpdate", () => {
  it("rejects empty body", () => {
    expect(validateWatchUpdate({}).ok).toBe(false);
  });

  it("accepts a single-field PATCH", () => {
    const r = validateWatchUpdate({ status: "paused" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update.status).toBe("paused");
    }
  });

  it("rejects unknown keys", () => {
    expect(validateWatchUpdate({ url: "https://example.com" }).ok).toBe(false);
    expect(validateWatchUpdate({ intent: "new intent" }).ok).toBe(false);
  });

  it("rejects status=running (runtime-only transition)", () => {
    expect(validateWatchUpdate({ status: "running" }).ok).toBe(false);
    expect(validateWatchUpdate({ status: "failed" }).ok).toBe(false);
  });

  it("validates cron on update", () => {
    expect(validateWatchUpdate({ cron: "0 9 * * 1" }).ok).toBe(true);
    expect(validateWatchUpdate({ cron: "noon" }).ok).toBe(false);
  });
});
