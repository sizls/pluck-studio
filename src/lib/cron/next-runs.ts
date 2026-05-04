// ---------------------------------------------------------------------------
// nextNRuns — pure helper returning the next N firing timestamps (UTC)
// ---------------------------------------------------------------------------
//
// Accepts 5-field cron OR a Vixie `@`-macro. Strategy: validate, expand
// macro to canonical, parse each field into Set<number>, then walk
// forward with a *cascading skip*. When the month, day, or hour of the
// candidate doesn't match, we jump to the start of the next valid
// month / day / hour rather than ticking minute-by-minute. Only when
// month + day + hour all match do we walk minute-by-minute (at most
// 60 iterations per fire). This keeps `@yearly` and other rare
// patterns near-instant and bounds adversarial input by an iteration
// ceiling rather than by elapsed wall-clock time.
//
// UTC, deterministic given `from`. No Date mutation.
// ---------------------------------------------------------------------------

import { CRON_FIELD_BOUNDS, CRON_MACRO_PATTERN, validateCron } from "./validate";

// 5-year horizon covers @yearly × 5 with margin. We use the *maximum*
// possible 5-year span (366-day years) so leap-day spillover doesn't push
// the 5th @yearly fire past the horizon. A real 5 years can span 1827
// days when straddling two leap years; 1825 days (5 × 365) was an
// undercount that dropped the final fire for some anchor dates. M4 fix.
//
// The hard ceiling is the iteration count, not the time window — see
// MAX_ITERATIONS below.
const MAX_HORIZON_MS = 5 * 366 * 24 * 60 * 60 * 1000;

// Hard ceiling on walker iterations. With smart-skip, @yearly costs ~5
// iterations per fire, and `* * * * *` costs 1 iteration per fire. 5M
// is comfortably above any sane workload (e.g. `*/15 * * * *` × 7 fires
// = 7 iterations) but rejects pathologically-crafted patterns.
const MAX_ITERATIONS = 5_000_000;

const MACRO_TO_CANONICAL: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

// dom/dow OR semantics: classic cron — when both fields are restricted,
// fire if EITHER matches; when one is `*`, only the other applies.
interface ParsedCron {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly daysOfMonth: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly daysOfWeek: ReadonlySet<number>; // 0-6, Sun=0 (7 collapses to 0)
  readonly domStar: boolean;
  readonly dowStar: boolean;
}

function expandAtom(
  atom: string,
  bounds: { readonly min: number; readonly max: number },
): number[] {
  const slashIdx = atom.indexOf("/");
  let head = atom;
  let step = 1;
  if (slashIdx !== -1) {
    head = atom.slice(0, slashIdx);
    step = Number.parseInt(atom.slice(slashIdx + 1), 10);
  }

  let lo: number;
  let hi: number;
  if (head === "*") {
    lo = bounds.min;
    hi = bounds.max;
  } else {
    const dashIdx = head.indexOf("-");
    if (dashIdx !== -1) {
      lo = Number.parseInt(head.slice(0, dashIdx), 10);
      hi = Number.parseInt(head.slice(dashIdx + 1), 10);
    } else {
      lo = Number.parseInt(head, 10);
      // `5/15` walks lo→max; bare `5` is just lo.
      hi = slashIdx !== -1 ? bounds.max : lo;
    }
  }

  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) {
    out.push(v);
  }

  return out;
}

function expandField(
  field: string,
  bounds: { readonly min: number; readonly max: number },
): number[] {
  const set = new Set<number>();
  for (const atom of field.split(",")) {
    for (const v of expandAtom(atom, bounds)) {
      set.add(v);
    }
  }

  return [...set];
}

function parseCron(expr: string): ParsedCron | null {
  const canonical = CRON_MACRO_PATTERN.test(expr)
    ? MACRO_TO_CANONICAL[expr]
    : expr;
  if (canonical === undefined) {
    return null;
  }
  const fields = canonical.split(/[\t ]+/);
  if (fields.length !== 5) {
    return null;
  }
  const [minF, hourF, domF, monthF, dowF] = fields;
  if (
    minF === undefined ||
    hourF === undefined ||
    domF === undefined ||
    monthF === undefined ||
    dowF === undefined
  ) {
    return null;
  }

  const minutes = new Set(expandField(minF, CRON_FIELD_BOUNDS[0]!));
  const hours = new Set(expandField(hourF, CRON_FIELD_BOUNDS[1]!));
  const daysOfMonth = new Set(expandField(domF, CRON_FIELD_BOUNDS[2]!));
  const months = new Set(expandField(monthF, CRON_FIELD_BOUNDS[3]!));
  // 7 collapses to 0 (Sunday).
  const daysOfWeek = new Set(
    expandField(dowF, CRON_FIELD_BOUNDS[4]!).map((d) => (d === 7 ? 0 : d)),
  );

  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    domStar: domF === "*",
    dowStar: dowF === "*",
  };
}

/**
 * Compute the next N firing timestamps for `expr` strictly after `from`.
 * Returns `[]` if `expr` is invalid OR if `n <= 0` after coercion. UTC.
 *
 * `n` is coerced via `Math.max(0, Math.floor(n))` so NaN, negative, and
 * fractional inputs are robust. Walker is bounded by iteration count,
 * not wall-clock; rare patterns (`@yearly`, leap-day) return promptly,
 * adversarial patterns are rejected at the iteration ceiling.
 *
 * Pure: deterministic given `from`.
 */
export function nextNRuns(
  expr: string,
  n = 7,
  from: number = Date.now(),
): Date[] {
  // Coerce N defensively: NaN → 0, negatives → 0, fractions → floor.
  const target = Math.max(0, Math.floor(Number(n)));
  if (target === 0 || !validateCron(expr)) {
    return [];
  }
  const parsed = parseCron(expr);
  if (parsed === null) {
    return [];
  }

  const out: Date[] = [];
  // Step strictly past `from`: round up to the next minute boundary.
  let t = Math.floor(from / 60000) * 60000 + 60000;
  const horizon = from + MAX_HORIZON_MS;
  let iterations = 0;

  while (t <= horizon && out.length < target && iterations < MAX_ITERATIONS) {
    iterations += 1;
    const d = new Date(t);
    const year = d.getUTCFullYear();
    const monthIdx = d.getUTCMonth(); // 0-11
    const dayOfMonth = d.getUTCDate();
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();

    // Month skip: jump to start of next month at 00:00:00 UTC.
    if (!parsed.months.has(monthIdx + 1)) {
      t = Date.UTC(year, monthIdx + 1, 1, 0, 0, 0);
      continue;
    }

    // Day skip (dom/dow OR semantics): jump to start of next day.
    const domMatch = parsed.daysOfMonth.has(dayOfMonth);
    const dowMatch = parsed.daysOfWeek.has(d.getUTCDay());
    let dayOk: boolean;
    if (parsed.domStar && parsed.dowStar) {
      dayOk = true;
    } else if (parsed.domStar) {
      dayOk = dowMatch;
    } else if (parsed.dowStar) {
      dayOk = domMatch;
    } else {
      // Both restricted → fire if EITHER matches.
      dayOk = domMatch || dowMatch;
    }
    if (!dayOk) {
      t = Date.UTC(year, monthIdx, dayOfMonth + 1, 0, 0, 0);
      continue;
    }

    // Hour skip: jump to next hour at :00.
    if (!parsed.hours.has(hour)) {
      t = Date.UTC(year, monthIdx, dayOfMonth, hour + 1, 0, 0);
      continue;
    }

    // Minute walk: only iteration that ticks +60s. Bounded to 60 per fire
    // because the hour-skip lands us at :00 each time we enter this loop.
    if (!parsed.minutes.has(minute)) {
      t += 60_000;
      continue;
    }

    out.push(d);
    t += 60_000;
  }

  return out;
}
