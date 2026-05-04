// ---------------------------------------------------------------------------
// nextNRuns — pure helper returning the next N firing timestamps (UTC)
// ---------------------------------------------------------------------------
//
// Accepts 5-field cron OR a Vixie `@`-macro. Strategy: validate, expand
// macro to canonical, parse each field into Set<number>, walk forward
// minute-by-minute from `from + 60s` (UTC). Bail at 7 days for dead
// patterns (e.g. `0 0 31 2 *`); 5-year horizon for live ones.
// Pure: no Date mutation, deterministic given `from`.
// ---------------------------------------------------------------------------

import { CRON_FIELD_BOUNDS, CRON_MACRO_PATTERN, validateCron } from "./validate";

const FIRST_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HORIZON_MS = 5 * 365 * 24 * 60 * 60 * 1000;

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
 * Returns `[]` if `expr` is invalid OR the pattern doesn't fire within
 * 7 days. UTC. Pure: deterministic given `from`.
 */
export function nextNRuns(
  expr: string,
  n = 7,
  from: number = Date.now(),
): Date[] {
  if (!validateCron(expr) || n <= 0) {
    return [];
  }
  const parsed = parseCron(expr);
  if (parsed === null) {
    return [];
  }

  const out: Date[] = [];
  const start = Math.floor(from / 60000) * 60000 + 60000;
  const firstMatchDeadline = from + FIRST_MATCH_WINDOW_MS;
  const horizon = from + MAX_HORIZON_MS;

  for (let t = start; t <= horizon && out.length < n; t += 60000) {
    if (out.length === 0 && t > firstMatchDeadline) {
      return [];
    }
    const d = new Date(t);
    if (!parsed.minutes.has(d.getUTCMinutes())) {
      continue;
    }
    if (!parsed.hours.has(d.getUTCHours())) {
      continue;
    }
    if (!parsed.months.has(d.getUTCMonth() + 1)) {
      continue;
    }
    const domMatch = parsed.daysOfMonth.has(d.getUTCDate());
    const dowMatch = parsed.daysOfWeek.has(d.getUTCDay());
    if (parsed.domStar && parsed.dowStar) {
      // pass — neither field restricts the day
    } else if (parsed.domStar) {
      if (!dowMatch) {
        continue;
      }
    } else if (parsed.dowStar) {
      if (!domMatch) {
        continue;
      }
    } else if (!domMatch && !dowMatch) {
      continue;
    }

    out.push(d);
  }

  return out;
}
