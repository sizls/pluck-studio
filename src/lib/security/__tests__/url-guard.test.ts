// ---------------------------------------------------------------------------
// url-guard — SSRF defense tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  validatePublicUrl,
  validateResolvedIp,
} from "../url-guard.js";

describe("validatePublicUrl — accepts", () => {
  it("a normal https URL", () => {
    const r = validatePublicUrl("https://example.com/foo");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hostname).toBe("example.com");
    }
  });

  it("a normal http URL", () => {
    expect(validatePublicUrl("http://example.com/").ok).toBe(true);
  });

  it("a public IPv4", () => {
    expect(validatePublicUrl("https://8.8.8.8/").ok).toBe(true);
  });

  it("a public IPv6", () => {
    expect(validatePublicUrl("https://[2606:4700:4700::1111]/").ok).toBe(true);
  });
});

describe("validatePublicUrl — rejects schemes", () => {
  it("ftp://", () => {
    expect(validatePublicUrl("ftp://example.com/").ok).toBe(false);
  });

  it("file://", () => {
    expect(validatePublicUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("gopher://", () => {
    expect(validatePublicUrl("gopher://example.com/").ok).toBe(false);
  });

  it("dict://", () => {
    expect(validatePublicUrl("dict://example.com/").ok).toBe(false);
  });
});

describe("validatePublicUrl — rejects localhost variants", () => {
  it("literal localhost", () => {
    expect(validatePublicUrl("http://localhost/foo").ok).toBe(false);
  });

  it("trailing-dot localhost (bypass attempt)", () => {
    expect(validatePublicUrl("http://localhost./foo").ok).toBe(false);
  });

  it("uppercase LOCALHOST", () => {
    expect(validatePublicUrl("http://LOCALHOST/").ok).toBe(false);
  });

  it("localhost as the first label of a longer host", () => {
    expect(validatePublicUrl("http://localhost.attacker.com/").ok).toBe(false);
  });

  it("127.0.0.1", () => {
    expect(validatePublicUrl("http://127.0.0.1/").ok).toBe(false);
  });

  it("127.0.0.1 with trailing dot", () => {
    expect(validatePublicUrl("http://127.0.0.1./").ok).toBe(false);
  });

  it("0.0.0.0", () => {
    expect(validatePublicUrl("http://0.0.0.0/").ok).toBe(false);
  });

  it("`0` shorthand (URL normalizes to 0.0.0.0)", () => {
    expect(validatePublicUrl("http://0/").ok).toBe(false);
  });
});

describe("validatePublicUrl — rejects RFC1918 + reserved IPv4", () => {
  it("10/8", () => {
    expect(validatePublicUrl("http://10.0.0.1/").ok).toBe(false);
  });

  it("172.16/12 boundaries", () => {
    expect(validatePublicUrl("http://172.16.0.1/").ok).toBe(false);
    expect(validatePublicUrl("http://172.31.255.255/").ok).toBe(false);
    // 172.32 is OUTSIDE RFC1918 — should pass.
    expect(validatePublicUrl("http://172.32.0.1/").ok).toBe(true);
  });

  it("192.168/16", () => {
    expect(validatePublicUrl("http://192.168.1.1/").ok).toBe(false);
  });

  it("169.254/16 link-local", () => {
    expect(validatePublicUrl("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
  });

  it("100.64/10 CGN", () => {
    expect(validatePublicUrl("http://100.64.0.1/").ok).toBe(false);
  });

  it("multicast 224.0.0.0/4", () => {
    expect(validatePublicUrl("http://224.0.0.1/").ok).toBe(false);
  });
});

describe("validatePublicUrl — rejects IPv6 private ranges", () => {
  it("::1 loopback", () => {
    expect(validatePublicUrl("http://[::1]/").ok).toBe(false);
  });

  it(":: unspecified", () => {
    expect(validatePublicUrl("http://[::]/").ok).toBe(false);
  });

  it("fc00::/7 ULA", () => {
    expect(validatePublicUrl("http://[fc00::1]/").ok).toBe(false);
    expect(validatePublicUrl("http://[fd00::1]/").ok).toBe(false);
  });

  it("fe80::/10 link-local", () => {
    expect(validatePublicUrl("http://[fe80::1]/").ok).toBe(false);
  });

  it("ff00::/8 multicast", () => {
    expect(validatePublicUrl("http://[ff02::1]/").ok).toBe(false);
  });

  it("::ffff:127.0.0.1 IPv4-mapped loopback", () => {
    expect(validatePublicUrl("http://[::ffff:127.0.0.1]/").ok).toBe(false);
  });
});

describe("validatePublicUrl — rejects userinfo + reserved TLDs", () => {
  it("user@host with an internal host", () => {
    // `http://attacker.com@127.0.0.1` — URL parser puts attacker.com in
    // username; hostname becomes 127.0.0.1. The guard rejects on
    // userinfo presence (defense-in-depth).
    expect(validatePublicUrl("http://attacker.com@127.0.0.1/").ok).toBe(false);
  });

  it("rejects any URL with userinfo", () => {
    expect(validatePublicUrl("http://u:p@example.com/").ok).toBe(false);
  });

  it("rejects .local (mDNS)", () => {
    expect(validatePublicUrl("http://printer.local/").ok).toBe(false);
  });

  it("rejects .internal", () => {
    expect(validatePublicUrl("http://k8s.internal/").ok).toBe(false);
  });

  it("rejects .test / .invalid", () => {
    expect(validatePublicUrl("http://foo.test/").ok).toBe(false);
    expect(validatePublicUrl("http://bar.invalid/").ok).toBe(false);
  });
});

describe("validatePublicUrl — input hardening", () => {
  it("rejects non-string input", () => {
    expect(validatePublicUrl(undefined as unknown as string).ok).toBe(false);
    expect(validatePublicUrl(null as unknown as string).ok).toBe(false);
    expect(validatePublicUrl(123 as unknown as string).ok).toBe(false);
  });

  it("rejects empty / whitespace-only", () => {
    expect(validatePublicUrl("").ok).toBe(false);
    expect(validatePublicUrl("   ").ok).toBe(false);
  });

  it("rejects extremely long URLs", () => {
    const url = `https://example.com/${"a".repeat(3000)}`;
    expect(validatePublicUrl(url).ok).toBe(false);
  });
});

describe("validateResolvedIp", () => {
  it("accepts public IPv4", () => {
    expect(validateResolvedIp("8.8.8.8")).toBeNull();
  });

  it("rejects loopback IPv4", () => {
    expect(validateResolvedIp("127.0.0.1")).not.toBeNull();
  });

  it("rejects RFC1918 IPv4", () => {
    expect(validateResolvedIp("10.0.0.1")).not.toBeNull();
    expect(validateResolvedIp("192.168.1.1")).not.toBeNull();
  });

  it("accepts public IPv6", () => {
    expect(validateResolvedIp("2606:4700:4700::1111")).toBeNull();
  });

  it("rejects IPv6 loopback / link-local / ULA", () => {
    expect(validateResolvedIp("::1")).not.toBeNull();
    expect(validateResolvedIp("fe80::1")).not.toBeNull();
    expect(validateResolvedIp("fc00::1")).not.toBeNull();
  });

  it("rejects non-IP input", () => {
    expect(validateResolvedIp("example.com")).not.toBeNull();
  });
});
