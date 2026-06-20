// ---------------------------------------------------------------------------
// NucleiRunForm — prefill extractor unit tests
// ---------------------------------------------------------------------------
//
// The pure helper `extractNucleiPrefill` is the contract surface for the
// SBOM-AI → NUCLEI cross-publish handoff. The actual form component reads
// from `useSearchParams()` and threads the result into the Directive
// system facts; pinning the helper independently lets us assert the
// trim + lowercase + null-coalesce behavior without a Next router
// harness.
//
// Companion integration: e2e/nuclei-sbom-ai-loop.spec.ts exercises the
// full ?sbomRekorUuid=&packName= round-trip through Playwright.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { extractNucleiPrefill } from "../RunForm";
import { createSystem } from "@directive-run/core";
import { nucleiRunFormModule } from "../../../../../lib/nuclei/run-form-module";

const REKOR_UUID =
  "DEADBEEFCAFEF00DDEADBEEFCAFEF00DDEADBEEFCAFEF00DDEADBEEFCAFEF00D";
const REKOR_UUID_LC = REKOR_UUID.toLowerCase();
const PACK = "canon-honesty@0.1";

function paramsOf(record: Record<string, string>): URLSearchParams {
  return new URLSearchParams(record);
}

describe("extractNucleiPrefill", () => {
  it("returns wasPrefilled=false when neither param is present", () => {
    const out = extractNucleiPrefill(paramsOf({}));
    expect(out.wasPrefilled).toBe(false);
    expect(out.sbomRekorUuid).toBeNull();
    expect(out.packName).toBeNull();
  });

  it("lowercases + trims the rekor UUID", () => {
    const out = extractNucleiPrefill(
      paramsOf({ sbomRekorUuid: `  ${REKOR_UUID}  ` }),
    );
    expect(out.wasPrefilled).toBe(true);
    expect(out.sbomRekorUuid).toBe(REKOR_UUID_LC);
  });

  it("trims (but does NOT lowercase) the pack name — versions can be case-sensitive", () => {
    const out = extractNucleiPrefill(paramsOf({ packName: ` ${PACK} ` }));
    expect(out.wasPrefilled).toBe(true);
    expect(out.packName).toBe(PACK);
  });

  it("flags wasPrefilled=true when only sbomRekorUuid is present", () => {
    const out = extractNucleiPrefill(
      paramsOf({ sbomRekorUuid: REKOR_UUID_LC }),
    );
    expect(out.wasPrefilled).toBe(true);
    expect(out.sbomRekorUuid).toBe(REKOR_UUID_LC);
    expect(out.packName).toBeNull();
  });

  it("flags wasPrefilled=true when only packName is present", () => {
    const out = extractNucleiPrefill(paramsOf({ packName: PACK }));
    expect(out.wasPrefilled).toBe(true);
    expect(out.sbomRekorUuid).toBeNull();
    expect(out.packName).toBe(PACK);
  });

  it("treats an empty-string param as unset", () => {
    // ?sbomRekorUuid= still surfaces the banner (the param key is present)
    // but doesn't seed the form facts with a junk empty string.
    const out = extractNucleiPrefill(paramsOf({ sbomRekorUuid: "" }));
    expect(out.wasPrefilled).toBe(true);
    expect(out.sbomRekorUuid).toBeNull();
  });
});

describe("NucleiRunForm — prefill seeds the Directive form module facts", () => {
  it("seeds sbomRekorUuid + packName onto the form module", () => {
    const sys = createSystem({ module: nucleiRunFormModule });
    sys.start();
    const prefill = extractNucleiPrefill(
      paramsOf({ sbomRekorUuid: REKOR_UUID, packName: PACK }),
    );
    if (prefill.sbomRekorUuid !== null) {
      sys.facts.sbomRekorUuid = prefill.sbomRekorUuid;
    }
    if (prefill.packName !== null) {
      sys.facts.packName = prefill.packName;
    }

    expect(sys.facts.sbomRekorUuid).toBe(REKOR_UUID_LC);
    expect(sys.facts.packName).toBe(PACK);

    // The seeded values must satisfy the form module's existing
    // validators — otherwise the operator would land on a form that
    // can never submit. Check the derivations the submit-enabled
    // gate reads.
    expect(sys.derive.sbomRekorUuidIsValid).toBe(true);

    sys.destroy();
  });
});
