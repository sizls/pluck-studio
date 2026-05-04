// ---------------------------------------------------------------------------
// validateCron — 5-field cron grammar validator (extracted from NUCLEI form)
// ---------------------------------------------------------------------------
//
// Fields (in order):
//   minute        0-59
//   hour          0-23
//   day-of-month  1-31
//   month         1-12
//   day-of-week   0-7  (0 and 7 both = Sun)
//
// Each field is one of: `*`, integer, list (`a,b,c`), range (`a-b`),
// step (`*/n` or `a-b/n`), or a comma-list combining the above.
// Whitespace between fields is one-or-more spaces or tabs; leading /
// trailing whitespace on the whole expression is rejected.
//
// Additionally accepts the standard Vixie/ISC `@`-macros — these are
// honored by every real-world cron daemon (Vixie cron, ISC cron,
// Cloudflare Workers cron, GitHub Actions cron) and every Node lib
// (`cron-parser`, `croner`, `node-cron`). Probe-pack authors using
// `@daily` via the CLI would otherwise round-trip-fail at our submit
// boundary. Macros are case-sensitive (per POSIX). `@reboot` is
// intentionally rejected — runtime-relative, doesn't make sense for
// a registry-published interval.
// ---------------------------------------------------------------------------

export const CRON_MACRO_PATTERN =
  /^@(yearly|annually|monthly|weekly|daily|midnight|hourly)$/;

export interface CronFieldBounds {
  readonly min: number;
  readonly max: number;
}

export const CRON_FIELD_BOUNDS: ReadonlyArray<CronFieldBounds> = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day-of-month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day-of-week (0 + 7 = Sun)
];

function isValidCronInteger(token: string, bounds: CronFieldBounds): boolean {
  if (!/^\d+$/.test(token)) {
    return false;
  }
  const n = Number.parseInt(token, 10);

  return n >= bounds.min && n <= bounds.max;
}

function isValidCronAtom(atom: string, bounds: CronFieldBounds): boolean {
  // Handle step: <range-or-star>/<positive-int>
  const slashIdx = atom.indexOf("/");
  if (slashIdx !== -1) {
    const head = atom.slice(0, slashIdx);
    const step = atom.slice(slashIdx + 1);
    if (!/^\d+$/.test(step)) {
      return false;
    }
    const stepN = Number.parseInt(step, 10);
    if (stepN <= 0) {
      return false;
    }
    if (head === "*") {
      return true;
    }

    return isValidCronAtom(head, bounds);
  }

  if (atom === "*") {
    return true;
  }

  // Range: a-b
  const dashIdx = atom.indexOf("-");
  if (dashIdx !== -1) {
    const a = atom.slice(0, dashIdx);
    const b = atom.slice(dashIdx + 1);
    if (!isValidCronInteger(a, bounds) || !isValidCronInteger(b, bounds)) {
      return false;
    }

    return Number.parseInt(a, 10) <= Number.parseInt(b, 10);
  }

  return isValidCronInteger(atom, bounds);
}

function isValidCronField(field: string, bounds: CronFieldBounds): boolean {
  if (field.length === 0) {
    return false;
  }
  const atoms = field.split(",");
  for (const atom of atoms) {
    if (atom.length === 0) {
      return false;
    }
    if (!isValidCronAtom(atom, bounds)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a 5-field cron expression OR a Vixie/ISC `@`-macro.
 * Tight grammar: rejects 6-field (seconds), trailing whitespace,
 * and out-of-range values.
 */
export function validateCron(s: string): boolean {
  if (typeof s !== "string") {
    return false;
  }
  if (s !== s.trim() || s.length === 0) {
    return false;
  }
  if (CRON_MACRO_PATTERN.test(s)) {
    return true;
  }
  const fields = s.split(/[\t ]+/);
  if (fields.length !== CRON_FIELD_BOUNDS.length) {
    return false;
  }
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const bounds = CRON_FIELD_BOUNDS[i];
    if (field === undefined || bounds === undefined) {
      return false;
    }
    if (!isValidCronField(field, bounds)) {
      return false;
    }
  }

  return true;
}
