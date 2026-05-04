// ---------------------------------------------------------------------------
// programs/registry — phrase-ID prefix conventions invariant
// ---------------------------------------------------------------------------
//
// Locks the documented invariant that every active program has a
// phrase-ID prefix-source convention recorded. Adding a new program
// without an entry here means a future maintainer can't trace why a
// receipt URL prefix is what it is — and privacy/UX choices (e.g.
// WHISTLE routing-partner-not-source) won't survive across PRs.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  ACTIVE_PROGRAMS,
  PHRASE_ID_PREFIX_CONVENTIONS,
  PROGRAM_PRIVACY_POSTURE,
} from "../registry.js";

describe("PHRASE_ID_PREFIX_CONVENTIONS", () => {
  it("covers all 11 active programs", () => {
    const slugs = ACTIVE_PROGRAMS.map((p) => p.slug);
    expect(slugs.length).toBe(11);
    for (const slug of slugs) {
      expect(PHRASE_ID_PREFIX_CONVENTIONS).toHaveProperty(slug);
    }
  });

  it("every entry has a non-empty prefixSource and rationale", () => {
    for (const [slug, conv] of Object.entries(PHRASE_ID_PREFIX_CONVENTIONS)) {
      expect(conv.prefixSource, `${slug}.prefixSource`).toBeTruthy();
      expect(conv.rationale, `${slug}.rationale`).toBeTruthy();
      expect(conv.rationale.length, `${slug}.rationale length`).toBeGreaterThan(20);
    }
  });

  it("WHISTLE prefix-source is routing partner — NOT source (anonymity invariant)", () => {
    const whistle = PHRASE_ID_PREFIX_CONVENTIONS.whistle;
    expect(whistle).toBeDefined();
    expect(whistle?.prefixSource).toMatch(/routing partner/i);
    expect(whistle?.prefixSource).toMatch(/NOT source/i);
  });

  it("MOLE prefix-source is canary ID — NOT canary content (privacy invariant)", () => {
    const mole = PHRASE_ID_PREFIX_CONVENTIONS.mole;
    expect(mole).toBeDefined();
    expect(mole?.prefixSource).toMatch(/canary ID/i);
    expect(mole?.prefixSource).toMatch(/NOT canary content/i);
  });

  it("no extraneous entries — keys must match active program slugs", () => {
    const activeSlugs = new Set(ACTIVE_PROGRAMS.map((p) => p.slug));
    for (const slug of Object.keys(PHRASE_ID_PREFIX_CONVENTIONS)) {
      expect(activeSlugs.has(slug), `convention key ${slug} not in ACTIVE_PROGRAMS`).toBe(
        true,
      );
    }
  });
});

describe("PROGRAM_PRIVACY_POSTURE", () => {
  it("covers every active program", () => {
    for (const program of ACTIVE_PROGRAMS) {
      expect(
        PROGRAM_PRIVACY_POSTURE,
        `missing posture entry for ${program.slug}`,
      ).toHaveProperty(program.slug);
    }
  });

  it("every entry has at least 2 knowsNot items and 2 knows items", () => {
    for (const [slug, posture] of Object.entries(PROGRAM_PRIVACY_POSTURE)) {
      expect(
        posture.knowsNot.length,
        `${slug}.knowsNot count`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        posture.knows.length,
        `${slug}.knows count`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("every claim is non-trivially specific (>=12 chars)", () => {
    for (const [slug, posture] of Object.entries(PROGRAM_PRIVACY_POSTURE)) {
      for (const claim of posture.knowsNot) {
        expect(
          claim.length,
          `${slug}.knowsNot claim too vague: "${claim}"`,
        ).toBeGreaterThanOrEqual(12);
      }
      for (const claim of posture.knows) {
        expect(
          claim.length,
          `${slug}.knows claim too vague: "${claim}"`,
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("no extraneous entries — keys must match active program slugs", () => {
    const activeSlugs = new Set(ACTIVE_PROGRAMS.map((p) => p.slug));
    for (const slug of Object.keys(PROGRAM_PRIVACY_POSTURE)) {
      expect(
        activeSlugs.has(slug),
        `posture key ${slug} not in ACTIVE_PROGRAMS`,
      ).toBe(true);
    }
  });
});
