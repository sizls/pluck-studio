// ---------------------------------------------------------------------------
// redactWatchForGet — strips operator addresses from public reads
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { redactWatchForGet } from "../redact.js";

const fullRecord = {
  watchId: "openai-amber-falcon-3742",
  name: "OpenAI pricing watch",
  url: "https://openai.com/pricing",
  cron: "@daily",
  intent: "Watch for pricing changes.",
  fetcherKind: "playwright",
  autonomyMode: "diff-gated",
  status: "active",
  alertChannels: {
    dashboard: true,
    phraseId: true,
    email: ["alerts@example.com", "ops@example.com"],
    webhook: ["https://hooks.example.com/x"],
    slack: ["https://hooks.slack.com/services/T/B/X"],
  },
  confidenceThreshold: 0.75,
  diffThreshold: 0.02,
  ignoreSelectors: [".banner"],
  useVisionDefault: false,
  dailyBudgetUsd: 2.0,
  agentTokensSpentTotal: 0,
  agentCostUsdTotal: 0,
  lastObservationId: null,
  lastFiredAt: 1_700_000_000_000,
  receiptUrl: "/watch/openai-amber-falcon-3742",
  createdAt: "2026-05-13T00:00:00.000Z",
  updatedAt: "2026-05-13T00:00:00.000Z",
};

describe("redactWatchForGet", () => {
  it("strips email, webhook, and slack addresses; replaces with counts", () => {
    const safe = redactWatchForGet(fullRecord);
    expect(safe.alertChannels.dashboard).toBe(true);
    expect(safe.alertChannels.phraseId).toBe(true);
    expect(safe.alertChannels.emailCount).toBe(2);
    expect(safe.alertChannels.webhookCount).toBe(1);
    expect(safe.alertChannels.slackCount).toBe(1);
    // None of the original addresses should appear in the projected view.
    const json = JSON.stringify(safe);
    expect(json).not.toContain("alerts@example.com");
    expect(json).not.toContain("ops@example.com");
    expect(json).not.toContain("hooks.example.com");
    expect(json).not.toContain("hooks.slack.com");
  });

  it("preserves operator-visible fields (intent, url, status, thresholds)", () => {
    const safe = redactWatchForGet(fullRecord);
    expect(safe.watchId).toBe(fullRecord.watchId);
    expect(safe.intent).toBe(fullRecord.intent);
    expect(safe.url).toBe(fullRecord.url);
    expect(safe.status).toBe(fullRecord.status);
    expect(safe.confidenceThreshold).toBe(0.75);
    expect(safe.diffThreshold).toBe(0.02);
    expect(safe.dailyBudgetUsd).toBe(2.0);
  });

  it("renders lastFiredAt (Unix ms) as an ISO string for public consumers", () => {
    const safe = redactWatchForGet(fullRecord);
    expect(safe.lastFiredAt).toBe(
      new Date(1_700_000_000_000).toISOString(),
    );
  });

  it("passes through a null lastFiredAt", () => {
    const safe = redactWatchForGet({ ...fullRecord, lastFiredAt: null });
    expect(safe.lastFiredAt).toBeNull();
  });

  it("falls back to false for non-boolean dashboard/phraseId flags", () => {
    const safe = redactWatchForGet({
      ...fullRecord,
      alertChannels: {
        ...fullRecord.alertChannels,
        // Hostile / malformed shape — should still produce a safe boolean.
        dashboard: "yes" as unknown as boolean,
        phraseId: 1 as unknown as boolean,
      },
    });
    expect(safe.alertChannels.dashboard).toBe(false);
    expect(safe.alertChannels.phraseId).toBe(false);
  });
});
