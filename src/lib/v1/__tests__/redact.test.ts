// ---------------------------------------------------------------------------
// /v1/runs — per-pipeline GET-side redactor unit tests
// ---------------------------------------------------------------------------
//
// Locks the privacy contract:
//   - WHISTLE strips bundleUrl + manualRedactPhrase, keeps category,
//     routingPartner, anonymityCaveatAcknowledged, authorizationAcknowledged.
//   - ROTATE strips operatorNote, keeps oldKeyFingerprint,
//     newKeyFingerprint, reason, authorizationAcknowledged.
//   - Pass-through programs (DRAGNET / OATH / FINGERPRINT / CUSTODY /
//     BOUNTY / SBOM-AI / TRIPWIRE / NUCLEI / MOLE) preserve the payload
//     byte-for-byte.
//   - Registry is exhaustive — every Bureau pipeline has a redactor and
//     calling redactPayloadForGet(...) for any of them never throws.
//   - Redactor is non-mutating (returns a fresh object — store record
//     stays intact for idempotency).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { PAYLOAD_REDACTORS, redactPayloadForGet } from "../redact";
import { BUREAU_PIPELINES } from "../run-spec";

describe("redact — WHISTLE", () => {
  it("strips bundleUrl from the GET-side payload", () => {
    const payload = {
      bundleUrl: "https://example.com/tip.json",
      category: "training-data",
      routingPartner: "propublica",
      anonymityCaveatAcknowledged: true,
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:whistle", payload);
    expect("bundleUrl" in safe).toBe(false);
  });

  it("strips manualRedactPhrase from the GET-side payload", () => {
    const payload = {
      bundleUrl: "https://example.com/tip.json",
      category: "training-data",
      routingPartner: "propublica",
      manualRedactPhrase: "redact-this-phrase",
      anonymityCaveatAcknowledged: true,
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:whistle", payload);
    expect("manualRedactPhrase" in safe).toBe(false);
  });

  it("preserves category + routingPartner + ack flags", () => {
    const payload = {
      bundleUrl: "https://example.com/tip.json",
      category: "training-data",
      routingPartner: "propublica",
      manualRedactPhrase: "x",
      anonymityCaveatAcknowledged: true,
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:whistle", payload);
    expect(safe.category).toBe("training-data");
    expect(safe.routingPartner).toBe("propublica");
    expect(safe.anonymityCaveatAcknowledged).toBe(true);
    expect(safe.authorizationAcknowledged).toBe(true);
  });

  it("does not mutate the input payload", () => {
    const payload = {
      bundleUrl: "https://example.com/tip.json",
      category: "training-data",
      routingPartner: "propublica",
      anonymityCaveatAcknowledged: true,
      authorizationAcknowledged: true,
    };
    const before = { ...payload };
    redactPayloadForGet("bureau:whistle", payload);
    expect(payload).toEqual(before);
  });
});

describe("redact — ROTATE", () => {
  it("strips operatorNote from the GET-side payload", () => {
    const payload = {
      oldKeyFingerprint: "a".repeat(64),
      newKeyFingerprint: "b".repeat(64),
      reason: "compromised",
      operatorNote: "incident #42, attacker IOC: <internal>",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:rotate", payload);
    expect("operatorNote" in safe).toBe(false);
  });

  it("preserves both fingerprints + reason + ack", () => {
    const payload = {
      oldKeyFingerprint: "a".repeat(64),
      newKeyFingerprint: "b".repeat(64),
      reason: "compromised",
      operatorNote: "anything",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:rotate", payload);
    expect(safe.oldKeyFingerprint).toBe("a".repeat(64));
    expect(safe.newKeyFingerprint).toBe("b".repeat(64));
    expect(safe.reason).toBe("compromised");
    expect(safe.authorizationAcknowledged).toBe(true);
  });

  it("does not mutate the input payload", () => {
    const payload = {
      oldKeyFingerprint: "a".repeat(64),
      newKeyFingerprint: "b".repeat(64),
      reason: "routine",
      operatorNote: "scheduled",
      authorizationAcknowledged: true,
    };
    const before = { ...payload };
    redactPayloadForGet("bureau:rotate", payload);
    expect(payload).toEqual(before);
  });
});

describe("redact — pass-through programs", () => {
  it("DRAGNET preserves the full payload", () => {
    const payload = {
      targetUrl: "https://api.openai.com/v1/chat/completions",
      probePackId: "canon-honesty",
      cadence: "once",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:dragnet", payload);
    expect(safe).toEqual(payload);
  });

  it("OATH preserves the full payload", () => {
    const payload = {
      vendorDomain: "openai.com",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:oath", payload);
    expect(safe).toEqual(payload);
  });

  it("FINGERPRINT preserves the full payload", () => {
    const payload = {
      vendor: "openai",
      model: "gpt-4o",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:fingerprint", payload);
    expect(safe).toEqual(payload);
  });

  it("CUSTODY preserves the full payload (bundleUrl IS public for CUSTODY)", () => {
    const payload = {
      bundleUrl: "https://chat.openai.com/bundle.json",
      expectedVendor: "openai.com",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:custody", payload);
    expect(safe).toEqual(payload);
  });

  it("BOUNTY preserves the full payload (auth tokens are validator-rejected)", () => {
    const payload = {
      sourceRekorUuid: "a".repeat(64),
      target: "hackerone",
      program: "openai",
      vendor: "openai",
      model: "gpt-4o",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:bounty", payload);
    expect(safe).toEqual(payload);
  });

  it("SBOM-AI preserves the full payload", () => {
    const payload = {
      artifactUrl: "https://example.com/pack.json",
      artifactKind: "probe-pack",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:sbom-ai", payload);
    expect(safe).toEqual(payload);
  });

  it("TRIPWIRE preserves the full payload", () => {
    const payload = {
      machineId: "alice-mbp",
      policySource: "default",
      notarize: false,
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:tripwire", payload);
    expect(safe).toEqual(payload);
  });

  it("NUCLEI preserves the full payload", () => {
    const payload = {
      author: "alice",
      packName: "canon-honesty@0.1",
      sbomRekorUuid: "a".repeat(64),
      vendorScope: "openai/gpt-4o",
      license: "MIT",
      recommendedInterval: "0 */4 * * *",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:nuclei", payload);
    expect(safe).toEqual(payload);
  });

  it("MOLE preserves the full payload (canaryUrl is by-design public)", () => {
    const payload = {
      canaryId: "nyt-2024-01-15",
      canaryUrl: "https://example.com/canary.txt",
      fingerprintPhrases: "first phrase, second phrase",
      authorizationAcknowledged: true,
    };
    const safe = redactPayloadForGet("bureau:mole", payload);
    expect(safe).toEqual(payload);
  });
});

describe("redact — registry exhaustiveness", () => {
  it("every Bureau pipeline has a redactor entry", () => {
    for (const p of BUREAU_PIPELINES) {
      expect(PAYLOAD_REDACTORS[p]).toBeTypeOf("function");
    }
  });

  it("redactPayloadForGet runs for every Bureau pipeline without throwing", () => {
    const sample = { foo: "bar", nested: { x: 1 }, arr: [1, 2, 3] };
    for (const p of BUREAU_PIPELINES) {
      expect(() => redactPayloadForGet(p, sample)).not.toThrow();
    }
  });

  it("unknown pipelines fall through (PASS_THROUGH default)", () => {
    const payload = { x: 1 };
    expect(redactPayloadForGet("extract", payload)).toEqual(payload);
    expect(redactPayloadForGet("nonexistent:future", payload)).toEqual(payload);
  });
});
