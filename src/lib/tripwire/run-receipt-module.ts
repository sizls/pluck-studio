// ---------------------------------------------------------------------------
// tripwireRunReceiptModule — Directive module for TRIPWIRE receipt
// ---------------------------------------------------------------------------
//
// Receipt represents an *active deployment* (not a one-shot result):
//   - signed TripwirePolicy/v1 envelope
//   - JS install snippet operators paste into their dev machine
//   - ingestion endpoint URL where attestations land
//   - per-machine timeline link (existing /bureau/tripwire/me route)
//
// Verdicts:
//   - configured              — policy signed, machineId issued,
//                                snippet + endpoint returned
//   - machine-already-active  — machineId already has an active
//                                tripwire; rotate via ROTATE
//   - policy-malformed        — custom policy URL fetched but body
//                                wasn't a valid TripwirePolicy/v1
//   - policy-fetch-failed     — couldn't fetch custom policy URL
//   - not-found               — custom URL 404
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "configuration pending"
  | "fetching-policy"
  | "signing"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "configured"
  | "machine-already-active"
  | "policy-malformed"
  | "policy-fetch-failed"
  | "not-found";

/** TRIPWIRE spec predicateType. */
export const TRIPWIRE_PREDICATE_URI =
  "https://pluck.run/TripwirePolicy/v1";

export const tripwireRunReceiptModule = createModule(
  "tripwire-run-receipt",
  {
    schema: {
      facts: {
        id: t.string(),
        status: t.string<ReceiptStatus>(),
        verdict: t.string<Verdict>().nullable(),
        verdictDetail: t.string().nullable(),
        machineId: t.string().nullable(),
        policySource: t.string().nullable(),
        notarize: t.boolean().nullable(),
        // The number of upstream hosts in the active policy
        // (default allowlist = 5; custom can be more or fewer).
        watchedHostCount: t.number().nullable(),
        // The npm install command + the ENV var pointing at the
        // ingestion endpoint. Surfaced verbatim on the receipt so
        // operators can copy-paste.
        installSnippet: t.string().nullable(),
        ingestionEndpoint: t.string().nullable(),
        signerFingerprint: t.string().nullable(),
        policyUrl: t.string().nullable(),
        rekorUuid: t.string().nullable(),
        configuredAt: t.string().nullable(),
      },
      derivations: {
        isPending: t.boolean(),
        isConfigured: t.boolean(),
        isFailure: t.boolean(),
        verdictColor: t.string<"gray" | "red" | "amber" | "green">(),
        timelineUrl: t.string().nullable(),
      },
    },

    init: (facts) => {
      facts.id = "";
      facts.status = "configuration pending";
      facts.verdict = null;
      facts.verdictDetail = null;
      facts.machineId = null;
      facts.policySource = null;
      facts.notarize = null;
      facts.watchedHostCount = null;
      facts.installSnippet = null;
      facts.ingestionEndpoint = null;
      facts.signerFingerprint = null;
      facts.policyUrl = null;
      facts.rekorUuid = null;
      facts.configuredAt = null;
    },

    derive: {
      isPending: (facts) =>
        facts.status === "configuration pending" ||
        facts.status === "fetching-policy" ||
        facts.status === "signing" ||
        facts.status === "anchoring",
      isConfigured: (facts) =>
        facts.status === "anchored" && facts.verdict === "configured",
      isFailure: (facts) =>
        facts.status === "failed" ||
        (facts.verdict !== null &&
          facts.verdict !== "configured" &&
          facts.verdict !== "machine-already-active"),
      verdictColor: (facts) => {
        if (facts.verdict === null) {
          return "gray";
        }
        if (facts.verdict === "configured") {
          return "green";
        }
        // `machine-already-active` is amber — operator's intent
        // (configure THIS machine) is partially satisfied by an
        // existing active deployment; rotate or drop the existing
        // one to proceed.
        if (facts.verdict === "machine-already-active") {
          return "amber";
        }
        return "red";
      },
      timelineUrl: (facts) => {
        if (facts.machineId === null) {
          return null;
        }
        // Per the landing — per-machine timeline lives at /bureau/
        // tripwire/me. For the multi-machine future we'd need a
        // per-machine route; today we link to /me as the canonical
        // operator's-view route.
        return `/bureau/tripwire/me`;
      },
    },
  },
);
