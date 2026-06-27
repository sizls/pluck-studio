// ---------------------------------------------------------------------------
// Pluck / shared deprecation headers
// ---------------------------------------------------------------------------
//
// RFC 9745 (2024) replaced the abandoned RFC 8594 draft. The
// canonical Deprecation header now carries an IMF-fixdate (the date
// the resource was/will be deprecated), NOT the literal token "true"
// used by the draft. Production SDK retry layers and HTTP gateways
// increasingly expect the date form; the literal "true" is silently
// dropped or treated as a parse error by RFC 9745-aware clients.
//
// All 11 per-program POST aliases (/api/programs/<id>/run) became
// deprecated when the unified /api/v1/runs surface shipped on
// 2026-05-04. They sunset on 2026-12-31. The Link header points
// clients at the successor.
// ---------------------------------------------------------------------------

export const LEGACY_ALIAS_DEPRECATION_DATE =
  "Mon, 04 May 2026 00:00:00 GMT";

export const LEGACY_ALIAS_SUNSET_DATE =
  "Wed, 31 Dec 2026 23:59:59 GMT";

export const LEGACY_ALIAS_SUCCESSOR_LINK =
  '</api/v1/runs>; rel="successor-version"';

export const DEPRECATION_HEADERS: Readonly<Record<string, string>> =
  Object.freeze({
    Deprecation: LEGACY_ALIAS_DEPRECATION_DATE,
    Sunset: LEGACY_ALIAS_SUNSET_DATE,
    Link: LEGACY_ALIAS_SUCCESSOR_LINK,
  });
