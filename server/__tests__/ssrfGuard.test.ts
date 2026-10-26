// server/__tests__/ssrfGuard.test.ts
// Dedicated regression suite for the SSRF protection engine
// (server/ssrfGuard.ts) — the one 2026-09-30 hardening artifact that
// previously had no dedicated test (AGENTS.md section 6, open threads).
//
// Scope: the pure validation surface (isPrivateIPv4 / isPrivateIPv6 /
// isDisallowedIP / isHostnameAllowed / validateUrlForSSRF) plus the
// sourcesRegistry-derived hostname-allowlist invariants. The dns module
// is mocked for hostname-resolution cases, so this suite opens NO
// sockets and makes NO network calls. safeFetch socket behavior (IP
// pinning, redirect stepping, size/timeout caps) is intentionally out
// of scope — it requires a live upstream and is exercised by the scrape
// paths.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock('dns', () => ({
  default: { promises: { lookup: mockLookup } },
}));

import {
  isPrivateIPv4,
  isPrivateIPv6,
  isDisallowedIP,
  isHostnameAllowed,
  validateUrlForSSRF,
  SOURCE_REGISTRY_HOSTNAMES,
} from '../ssrfGuard';

beforeEach(() => {
  mockLookup.mockReset();
  // Default: any unexpected DNS path in these tests resolves to a
  // public documentation address rather than hitting the real resolver.
  mockLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
});

describe('isPrivateIPv4 - RFC1918/reserved/metadata ranges are blocked', () => {
  it('blocks loopback, RFC1918, link-local (cloud metadata), CGNAT, benchmark, multicast and reserved ranges', () => {
    for (const ip of [
      '0.0.0.0',             // 0.0.0.0/8 current network
      '10.255.0.1',          // 10.0.0.0/8 RFC1918
      '127.0.0.1',           // loopback
      '169.254.169.254',     // link-local / cloud metadata endpoint
      '172.16.0.1',          // 172.16.0.0/12 lower bound
      '172.31.255.255',      // 172.16.0.0/12 upper bound
      '192.168.1.1',         // 192.168.0.0/16
      '100.64.0.1',          // 100.64.0.0/10 CGNAT lower bound
      '100.127.255.254',     // CGNAT upper bound
      '198.18.0.1',          // 198.18.0.0/15 benchmark
      '198.19.200.1',
      '224.0.0.1',           // 224.0.0.0/4 multicast
      '239.1.1.1',
      '240.0.0.1',           // 240.0.0.0/4 reserved
      '255.255.255.255',
    ]) {
      expect(isPrivateIPv4(ip)).toBe(true);
    }
  });

  it('allows public unicast addresses, including boundaries just outside the blocks', () => {
    for (const ip of [
      '1.1.1.1',
      '8.8.8.8',
      '172.15.255.255',      // just below 172.16.0.0/12
      '172.32.0.1',          // just above
      '100.63.0.1',          // just below CGNAT
      '100.128.0.1',         // just above
      '198.17.0.1',          // just below benchmark
      '198.20.0.1',          // just above
      '223.255.255.254',     // just below multicast
    ]) {
      expect(isPrivateIPv4(ip)).toBe(false);
    }
  });

  it('fail-closes on malformed input (invalid octets, wrong part counts, non-numeric)', () => {
    for (const ip of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '999.0.0.1', 'a.b.c.d']) {
      expect(isPrivateIPv4(ip)).toBe(true);
    }
  });
});

describe('isPrivateIPv6 - loopback/ULA/link-local and IPv4-mapped ranges are blocked', () => {
  it('blocks ::1, unspecified ::, ULA fc00::/7 and link-local fe80::/10', () => {
    for (const ip of [
      '::1',
      '0:0:0:0:0:0:0:1',
      '::',
      '0:0:0:0:0:0:0:0',
      'fc00::1',
      'fdab:1234::9',
      'fe80::1',
      'fe90::',
      'fea1::',
      'feb0::1',
      'FE80::1',             // upper-case input is normalized
      '::FFFF:10.0.0.1',     // IPv4-mapped private
    ]) {
      expect(isPrivateIPv6(ip)).toBe(true);
    }
  });

  it('allows public IPv6 and IPv4-mapped public addresses', () => {
    for (const ip of [
      '::ffff:8.8.8.8',
      '2001:4860:4860::8888',
      '2606:4700:4700::1111',
      'fec0::1',             // fe80::/10 upper edge — outside the blocked /10
    ]) {
      expect(isPrivateIPv6(ip)).toBe(false);
    }
  });
});

describe('isDisallowedIP - dispatches by family and fail-closes on unknown input', () => {
  it('routes IPv4 and IPv6 correctly', () => {
    expect(isDisallowedIP('10.0.0.1')).toBe(true);
    expect(isDisallowedIP('1.2.3.4')).toBe(false);
    expect(isDisallowedIP('fe80::1')).toBe(true);
    expect(isDisallowedIP('2606:4700:4700::1111')).toBe(false);
  });

  it('treats unrecognized input as unsafe', () => {
    expect(isDisallowedIP('bogus')).toBe(true);
    expect(isDisallowedIP('')).toBe(true);
  });
});

describe('isHostnameAllowed - allowlist matching (exact + subdomain)', () => {
  it('allows everything when no allowlist is configured', () => {
    expect(isHostnameAllowed('anything.example')).toBe(true);
    expect(isHostnameAllowed('anything.example', [])).toBe(true);
  });

  it('matches exact hostnames and subdomains, case-insensitively', () => {
    expect(isHostnameAllowed('msi.nga.mil', ['msi.nga.mil'])).toBe(true);
    expect(isHostnameAllowed('www.msi.nga.mil', ['msi.nga.mil'])).toBe(true);
    expect(isHostnameAllowed('MSI.NGA.MIL', ['msi.nga.mil'])).toBe(true);
  });

  it('rejects suffix look-alikes that are not real subdomains', () => {
    expect(isHostnameAllowed('evilexample.com', ['example.com'])).toBe(false);
    expect(isHostnameAllowed('msi.nga.mil.example.net', ['msi.nga.mil'])).toBe(false);
    expect(isHostnameAllowed('other.com', ['example.com'])).toBe(false);
  });
});

describe('validateUrlForSSRF - URL-level attack vectors (no DNS involved)', () => {
  it('rejects unparseable URLs', async () => {
    const r = await validateUrlForSSRF('not a url at all');
    expect(r.safe).toBe(false);
    expect(r.error).toBe('Invalid URL format');
  });

  it('rejects non-http protocols', async () => {
    for (const url of ['ftp://example.com/file', 'file:///etc/passwd', 'gopher://example.com']) {
      const r = await validateUrlForSSRF(url);
      expect(r.safe).toBe(false);
      expect(r.error ?? '').toMatch(/Disallowed protocol/);
    }
  });

  it('rejects embedded credentials (user:pass@host)', async () => {
    const r = await validateUrlForSSRF('https://user:secret@example.com/feed');
    expect(r.safe).toBe(false);
    expect(r.error ?? '').toMatch(/embedded user credentials/i);
  });

  it('rejects local-suffixed hostnames (localhost / .local / .internal)', async () => {
    for (const url of ['http://localhost/admin', 'http://app.localhost/x', 'http://printer.local/x', 'http://db.internal/x']) {
      const r = await validateUrlForSSRF(url);
      expect(r.safe).toBe(false);
      expect(r.error ?? '').toMatch(/local hostnames/i);
    }
  });

  it('blocks raw private/metadata IP literals outright', async () => {
    for (const url of [
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.5/internal',
      'http://127.0.0.1:8080/debug',
      'http://192.168.1.10/router',
    ]) {
      const r = await validateUrlForSSRF(url);
      expect(r.safe).toBe(false);
      expect(r.error ?? '').toMatch(/private or restricted IP/);
    }
  });

  it('accepts raw public IP literals and pins the connection to them', async () => {
    const r = await validateUrlForSSRF('https://8.8.8.8/dns-query');
    expect(r.safe).toBe(true);
    expect(r.pinnedAddresses).toEqual([{ address: '8.8.8.8', family: 4 }]);
  });

  it('enforces the hostname allowlist before IP/DNS checks', async () => {
    const r = await validateUrlForSSRF('https://8.8.8.8/x', ['msi.nga.mil']);
    expect(r.safe).toBe(false);
    expect(r.error ?? '').toMatch(/not in the trusted source registry allowlist/);
  });
});

describe('validateUrlForSSRF - DNS resolution paths (dns module mocked)', () => {
  it('allows hostnames that resolve only to public addresses, returning pinned addresses', async () => {
    mockLookup.mockResolvedValue([{ address: '203.0.113.7', family: 4 }]);
    const r = await validateUrlForSSRF('https://registry.example.org/feed');
    expect(r.safe).toBe(true);
    expect(r.pinnedAddresses).toEqual([{ address: '203.0.113.7', family: 4 }]);
    expect(mockLookup).toHaveBeenCalledWith('registry.example.org', { all: true });
  });

  it('blocks hostnames that resolve to a private or metadata address (DNS-rebinding style)', async () => {
    mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const r = await validateUrlForSSRF('https://attacker.example/token');
    expect(r.safe).toBe(false);
    expect(r.error ?? '').toMatch(/restricted address/);
  });

  it('blocks when ANY resolved address is unsafe (multi-A records)', async () => {
    mockLookup.mockResolvedValue([
      { address: '203.0.113.7', family: 4 },
      { address: 'fd00::1', family: 6 },
    ]);
    const r = await validateUrlForSSRF('https://mixed.example/feed');
    expect(r.safe).toBe(false);
    expect(r.error ?? '').toMatch(/restricted address/);
  });

  it('fail-closes when DNS returns no records', async () => {
    mockLookup.mockResolvedValue([]);
    const r = await validateUrlForSSRF('https://empty.example/feed');
    expect(r.safe).toBe(false);
    expect(r.error ?? '').toMatch(/Could not resolve/);
  });

  it('fail-closes on resolver errors', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND lookup failed'));
    const r = await validateUrlForSSRF('https://gone.example/feed');
    expect(r.safe).toBe(false);
    expect(r.error ?? '').toMatch(/DNS resolution failed/);
  });
});

describe('SOURCE_REGISTRY_HOSTNAMES - derived allowlist invariants', () => {
  it('is non-empty', () => {
    expect(SOURCE_REGISTRY_HOSTNAMES.length).toBeGreaterThan(0);
  });

  it('contains no duplicates, no protocol/path fragments (pure lowercase hostnames)', () => {
    for (const h of SOURCE_REGISTRY_HOSTNAMES) {
      expect(h).toBe(h.toLowerCase());
      expect(h).not.toMatch(/[:\/]/);
    }
    expect(new Set(SOURCE_REGISTRY_HOSTNAMES).size).toBe(SOURCE_REGISTRY_HOSTNAMES.length);
  });
});
