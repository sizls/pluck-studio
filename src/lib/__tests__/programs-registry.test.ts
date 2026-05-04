// ---------------------------------------------------------------------------
// programs/registry — invariant tests
// ---------------------------------------------------------------------------
//
// The registry is the single source of truth for which programs ship
// through the activation pattern. These tests lock the load-bearing
// invariants so adding/removing programs doesn't accidentally regress
// canonical metadata.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  ACTIVE_PROGRAMS,
  COMING_SOON_PROGRAMS,
} from "../programs/registry.js";

describe("ACTIVE_PROGRAMS", () => {
  it("includes ALL 11 alpha programs through the activation pattern", () => {
    const slugs = ACTIVE_PROGRAMS.map((p) => p.slug);
    expect(slugs.length).toBe(11);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "dragnet",
        "oath",
        "fingerprint",
        "custody",
        "whistle",
        "bounty",
        "sbom-ai",
        "rotate",
        "tripwire",
        "nuclei",
        "mole",
      ]),
    );
  });

  it("each program's runPath matches /bureau/<slug>/run", () => {
    for (const p of ACTIVE_PROGRAMS) {
      expect(p.runPath).toBe(`/bureau/${p.slug}/run`);
      expect(p.landingPath).toBe(`/bureau/${p.slug}`);
    }
  });

  it("predicate URIs are pluck.run / canonical and HTTPS", () => {
    for (const p of ACTIVE_PROGRAMS) {
      expect(p.predicateUri).toMatch(/^https:\/\/pluck\.run\//);
    }
  });

  it("name is ALL CAPS (Bureau program-name convention)", () => {
    for (const p of ACTIVE_PROGRAMS) {
      expect(p.name).toBe(p.name.toUpperCase());
    }
  });

  it("slugs are unique across active + coming-soon", () => {
    const allSlugs = [
      ...ACTIVE_PROGRAMS.map((p) => p.slug),
      ...COMING_SOON_PROGRAMS.map((p) => p.slug),
    ];
    const set = new Set(allSlugs);
    expect(set.size).toBe(allSlugs.length);
  });

  it("action verbs are unique across active programs", () => {
    const verbs = ACTIVE_PROGRAMS.map((p) => p.actionVerb);
    const set = new Set(verbs);
    expect(set.size).toBe(verbs.length);
  });
});

describe("COMING_SOON_PROGRAMS", () => {
  it("is empty — all 11 alpha programs are now active", () => {
    expect(COMING_SOON_PROGRAMS.length).toBe(0);
  });
});
