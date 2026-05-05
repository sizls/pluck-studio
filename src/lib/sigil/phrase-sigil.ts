// ---------------------------------------------------------------------------
// Phrase Crest — procedural SVG sigil per phrase ID
// ---------------------------------------------------------------------------
//
// Every phrase ID becomes a unique visual signature. A receipt URL like
// `swift-falcon-3742-vs-openai` decomposes into:
//   - adjective ("swift")  → fill hue (HSL hue 0..359, FNV-1a hashed)
//   - noun      ("falcon") → shape variant (one of 10 hand-built SVGs)
//   - serial    ("3742")   → text badge along the bottom edge
//   - program accent       → border stroke (passed in by the caller)
//
// Pure + deterministic — same phrase ID + opts → same SVG byte-for-byte.
// No Math.random, no Date.now, no external font loads, no animal art.
// All shapes hand-written from primitives + numeric attributes so nothing
// phrase-derived flows into the SVG raw (adjective/noun are HASHED,
// serial is digits-only via parsePhraseId). Self-contained: serial uses
// `font-family="ui-monospace, monospace"` — system mono only.
// ---------------------------------------------------------------------------

import { parsePhraseId } from "../phrase-id.js";

export type SigilShape =
  | "hexagon"
  | "triangle"
  | "diamond"
  | "circle"
  | "rounded-square"
  | "star-5"
  | "star-6"
  | "octagon"
  | "shield"
  | "chevron";

export interface PhraseSigilData {
  /** HSL color string for the primary fill — adjective-hashed hue. */
  readonly fillColor: string;
  /** Border stroke — program/scope accent (caller-provided or fallback). */
  readonly accentColor: string;
  /** Foreground geometric primitive — noun-hashed. */
  readonly shape: SigilShape;
  /** 4-digit serial badge, "" when input lacks one. Digits-only. */
  readonly serialBadge: string;
  /** Deterministic 32-bit unsigned seed derived from the full phrase ID. */
  readonly seed: number;
}

const SHAPES: ReadonlyArray<SigilShape> = [
  "hexagon",
  "triangle",
  "diamond",
  "circle",
  "rounded-square",
  "star-5",
  "star-6",
  "octagon",
  "shield",
  "chevron",
];

// Default border accent when the caller doesn't supply one. Mid-gray —
// blends with the Bureau monochrome chrome so a sigil without a program
// context still looks at-home in the page.
const DEFAULT_ACCENT = "#6b7280";

// FNV-1a 32-bit. Tiny, fast, deterministic across V8 / JSC / Hermes.
// Used for both `seedFromString` (whole phrase ID → numeric seed) and
// per-component hue / shape selection (adjective / noun → bucket).
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply with overflow trim.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/**
 * Build the deterministic data shape for a phrase ID. Reads the phrase
 * via `parsePhraseId` (which itself is pure) so any sanitization is
 * already done — `adjective` / `noun` / `serial` are vocabulary words
 * + digits only, never raw user input.
 */
export function phraseSigilData(
  phraseId: string,
  opts?: { programAccent?: string },
): PhraseSigilData {
  const parsed = parsePhraseId(phraseId);
  // Even when parsed.valid is false (3-part bare form, or fully
  // unparseable garbage), we still produce a sigil — the renderer
  // shouldn't blow up on legacy receipts. The fields fall back to
  // empty-string components, hashed the same way.
  const adjective = parsed.adjective;
  const noun = parsed.noun;
  const serial = parsed.serial;

  // Adjective hue: muted Bureau aesthetic — saturation 38%, lightness 42%.
  // The hue covers the full 0..359 wheel so two different adjectives
  // are visually distinct, but neon territory is excluded by capping S/L.
  const adjHash = fnv1a(adjective || "_");
  const hue = adjHash % 360;
  const fillColor = `hsl(${hue}, 38%, 42%)`;

  // Noun → shape variant from the 10-entry catalog. Cap = 10, no growth.
  const nounHash = fnv1a(noun || "_");
  const shape = SHAPES[nounHash % SHAPES.length] ?? "hexagon";

  // Serial badge: digits-only (validated by parsePhraseId regex). Empty
  // string when the input lacked a serial — renderer omits the text node.
  const serialBadge = /^\d{1,4}$/.test(serial) ? serial : "";

  // Seed = whole phrase fingerprint. Reserved for future per-sigil
  // micro-variations (jitter angles, grain seeds) — exposed today so
  // snapshots lock the determinism contract.
  const seed = fnv1a(parsed.normalized || phraseId);

  // Accent: caller-supplied color (program accent), validated as a
  // 3-or-6-digit hex or hsl() literal — defensively sanitized so an
  // attacker-controlled string can't break out of the SVG envelope.
  const accentColor = sanitizeAccent(opts?.programAccent) ?? DEFAULT_ACCENT;

  return { fillColor, accentColor, shape, serialBadge, seed };
}

/**
 * Allow only safe color literals through to the SVG attribute layer.
 * Accepts `#RGB`, `#RRGGBB`, `#RRGGBBAA`, and `hsl(...)` / `hsla(...)`
 * with numeric components only. Anything else → null → fallback accent.
 *
 * The PhraseSigil component renders SVG via `dangerouslySetInnerHTML`
 * so this is the chokepoint — the only attacker-influenced string that
 * flows into a SVG attribute.
 */
function sanitizeAccent(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 32) {
    return null;
  }
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^hsla?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%\s*(,\s*[\d.]+\s*)?\)$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// SVG renderer. ViewBox 100x100 fixed; width/height attrs scale via `size`.
// Layers (back→front): rounded-square bg with accent stroke + HSL gradient,
// chosen shape (~60% viewBox) in a complementary HSL, bottom serial text.

const VIEWBOX = 100;
const PADDING = 6;
const STROKE_WIDTH = 2;
const SHAPE_SIZE = 60;
const SHAPE_CX = 50;
const SHAPE_CY = 46;
const SERIAL_Y = 90;

/**
 * Pure-string SVG renderer. The React wrapper injects the bytes via
 * `dangerouslySetInnerHTML`. String concat (no JSX) so the output is
 * byte-stable across React versions and trivially snapshottable.
 */
export function renderPhraseSigil(
  data: PhraseSigilData,
  size: number = 64,
): string {
  const safeSize = Number.isFinite(size) && size > 0 ? Math.round(size) : 64;
  const fg = lightenHsl(data.fillColor, 22);
  const grad = lightenHsl(data.fillColor, 12);
  const gradId = `psg-${data.seed.toString(16).padStart(8, "0")}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-hidden="true">`,
    `<defs>`,
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${grad}"/>`,
    `<stop offset="100%" stop-color="${data.fillColor}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect x="${PADDING / 2}" y="${PADDING / 2}" width="${VIEWBOX - PADDING}" height="${VIEWBOX - PADDING}" rx="10" ry="10" fill="url(#${gradId})" stroke="${data.accentColor}" stroke-width="${STROKE_WIDTH}"/>`,
    renderShape(data.shape, SHAPE_CX, SHAPE_CY, SHAPE_SIZE, fg),
    data.serialBadge.length > 0
      ? `<text x="${VIEWBOX / 2}" y="${SERIAL_Y}" font-family="ui-monospace, monospace" font-size="12" font-weight="600" fill="${fg}" text-anchor="middle" letter-spacing="1">${data.serialBadge}</text>`
      : "",
    `</svg>`,
  ].join("");
}

/**
 * Shift the lightness component of an `hsl(h, s%, l%)` color literal
 * by `delta` percentage points. Clamps to [0, 100]. Used for the
 * gradient highlight + complementary foreground.
 */
function lightenHsl(hsl: string, delta: number): string {
  const m = /^hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/.exec(hsl);
  if (!m) {
    return hsl;
  }
  const h = m[1];
  const s = m[2];
  const lRaw = Number.parseFloat(m[3] ?? "50");
  const l = Math.min(100, Math.max(0, lRaw + delta));

  return `hsl(${h}, ${s}%, ${l.toFixed(0)}%)`;
}

/**
 * Render the chosen shape as SVG bytes, centered on (cx, cy) with a
 * bounding box of `size`. Each branch hand-builds primitives.
 */
function renderShape(
  shape: SigilShape,
  cx: number,
  cy: number,
  size: number,
  fill: string,
): string {
  const r = size / 2;

  switch (shape) {
    case "circle":
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

    case "rounded-square": {
      const half = r;

      return `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" rx="6" ry="6" fill="${fill}"/>`;
    }

    case "diamond":
      return `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${fill}"/>`;

    case "triangle": {
      const h = r * 0.866; // height-from-centroid for an equilateral

      return `<polygon points="${cx},${cy - r} ${cx + h},${cy + r / 2} ${cx - h},${cy + r / 2}" fill="${fill}"/>`;
    }

    case "hexagon": {
      const pts = polygonPoints(cx, cy, r, 6, -Math.PI / 2);

      return `<polygon points="${pts}" fill="${fill}"/>`;
    }

    case "octagon": {
      const pts = polygonPoints(cx, cy, r, 8, -Math.PI / 8);

      return `<polygon points="${pts}" fill="${fill}"/>`;
    }

    case "star-5": {
      const pts = starPoints(cx, cy, r, r * 0.42, 5, -Math.PI / 2);

      return `<polygon points="${pts}" fill="${fill}"/>`;
    }

    case "star-6": {
      const pts = starPoints(cx, cy, r, r * 0.55, 6, -Math.PI / 2);

      return `<polygon points="${pts}" fill="${fill}"/>`;
    }

    case "shield": {
      // Heater-shield silhouette. Top edge flat, sides bow gently in,
      // bottom comes to a centered point. Drawn via a path so the
      // curves stay smooth at any size.
      const top = cy - r;
      const bot = cy + r;
      const sideY = cy + r * 0.25;
      const left = cx - r;
      const right = cx + r;

      return `<path d="M ${left} ${top} L ${right} ${top} L ${right} ${sideY} Q ${right} ${bot} ${cx} ${bot} Q ${left} ${bot} ${left} ${sideY} Z" fill="${fill}"/>`;
    }

    case "chevron": {
      // Down-pointing chevron. Two stacked triangles offset vertically.
      const tip = cy + r;
      const top = cy - r;
      const mid = cy;
      const left = cx - r;
      const right = cx + r;

      return `<polygon points="${left},${top} ${cx},${mid} ${right},${top} ${right},${mid} ${cx},${tip} ${left},${mid}" fill="${fill}"/>`;
    }

    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
  }
}

function polygonPoints(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation: number,
): string {
  const pts: Array<string> = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return pts.join(" ");
}

function starPoints(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  spikes: number,
  rotation: number,
): string {
  const pts: Array<string> = [];
  const total = spikes * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rotation + (i * Math.PI) / spikes;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return pts.join(" ");
}

/** All shapes the renderer knows about — exported for tests + audits. */
export const SIGIL_SHAPES: ReadonlyArray<SigilShape> = SHAPES;
