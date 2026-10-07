/**
 * SSRF (Server-Side Request Forgery) Protection Engine
 *
 * Enforces strict security boundaries when fetching external resources for evidence enrichment.
 * Prevents requests to internal infrastructure, cloud metadata endpoints, loopback,
 * private subnets, and link-local networks.
 *
 * Security Features:
 * 1. Protocol validation: Only http: and https: allowed.
 * 2. Hostname allowlist: Built dynamically from src/data/sourcesRegistry.ts.
 * 3. DNS resolution & IP blocklist: Validates all returned IPv4 and IPv6 addresses against private/reserved ranges.
 * 4. Connection IP pinning: Pins socket connection to the pre-verified safe IP address, eliminating DNS rebinding (TOCTOU).
 * 5. Manual redirect inspection: Follows redirects step-by-step and validates each hop.
 * 6. Size limit: Aborts download if response exceeds 2MB.
 * 7. Timeout: Enforces a strict 10-second request timeout.
 */

import http from 'http';
import https from 'https';
import dns from 'dns';
import net from 'net';
import { INITIAL_SOURCES_REGISTRY } from '../src/data/sourcesRegistry.js';

export interface SafeFetchOptions {
  maxRedirects?: number;
  maxSizeBytes?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  allowedHostnames?: string[];
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  data: string;
}

/**
 * Hostname allowlist derived directly from source discovery URLs, entrypoints,
 * and allowed_hosts in sourcesRegistry.ts
 */
export const SOURCE_REGISTRY_HOSTNAMES: string[] = Array.from(
  new Set(
    INITIAL_SOURCES_REGISTRY.flatMap((s) => {
      const hosts: string[] = [];
      if (Array.isArray(s.allowed_hosts)) {
        hosts.push(...s.allowed_hosts.map((h) => h.toLowerCase().trim()));
      }
      if (s.discovery_url) {
        try {
          hosts.push(new URL(s.discovery_url).hostname.toLowerCase());
        } catch {}
      }
      if (Array.isArray(s.entrypoints)) {
        for (const ep of s.entrypoints) {
          try {
            hosts.push(new URL(ep).hostname.toLowerCase());
          } catch {}
        }
      }
      return hosts;
    }).filter((h): h is string => Boolean(h) && h.length > 0)
  )
);

/**
 * Checks whether an IPv4 address falls within private, loopback, or reserved subnets.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Block invalid IP format as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 - Current network
  if (a === 0) return true;

  // 10.0.0.0/8 - Private network RFC 1918
  if (a === 10) return true;

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 169.254.0.0/16 - Link-local / Cloud Metadata (169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 - Private network RFC 1918 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private network RFC 1918
  if (a === 192 && b === 168) return true;

  // 100.64.0.0/10 - Carrier-grade NAT RFC 6598
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 198.18.0.0/15 - Benchmark testing RFC 2544
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved
  if (a >= 240) return true;

  return false;
}

/**
 * Checks whether an IPv6 address falls within private, loopback, or local scopes.
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 - Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // :: - Unspecified address
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped IPv6: ::ffff:192.0.2.128
  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice(7);
    if (net.isIPv4(mappedIpv4)) {
      return isPrivateIPv4(mappedIpv4);
    }
  }

  // fc00::/7 - Unique Local Address (ULA) RFC 4193 (fc00:: through fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // fe80::/10 - Link-local address RFC 4291
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  return false;
}

/**
 * Determines whether any IP address (IPv4 or IPv6) is considered unsafe for outbound calls.
 */
export function isDisallowedIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIPv6(ip);
  }
  return true; // Reject unrecognized IP families
}

/**
 * Verifies whether a hostname matches the allowlist (supports exact and subdomain matches).
 */
export function isHostnameAllowed(hostname: string, allowedHostnames?: string[]): boolean {
  if (!allowedHostnames || allowedHostnames.length === 0) return true;
  const lowerHost = hostname.toLowerCase();
  return allowedHostnames.some((allowed) => {
    const lowerAllowed = allowed.toLowerCase();
    return lowerHost === lowerAllowed || lowerHost.endsWith(`.${lowerAllowed}`);
  });
}

/**
 * Validates a candidate URL string against SSRF attack vectors.
 * Checks protocol, credentials, hostname allowlist, and resolves DNS to verify IP addresses.
 */
export async function validateUrlForSSRF(
  rawUrl: string,
  allowedHostnames?: string[]
): Promise<{ safe: boolean; error?: string; urlObj?: URL; pinnedAddresses?: { address: string; family: number }[] }> {
  let parsedUrl: URL;

  // Step 1: Validate URL parseability
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { safe: false, error: 'Invalid URL format' };
  }

  // Step 2: Enforce http or https protocol only
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { safe: false, error: `Disallowed protocol: ${parsedUrl.protocol}. Only http and https are permitted.` };
  }

  // Step 3: Block embedded credentials (user:pass@host)
  if (parsedUrl.username || parsedUrl.password) {
    return { safe: false, error: 'URLs with embedded user credentials are prohibited.' };
  }

  const hostname = parsedUrl.hostname;

  // Step 4: Block direct localhost hostnames
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, error: 'Access to local hostnames is prohibited.' };
  }

  // Step 5: Check hostname allowlist if configured
  if (allowedHostnames && allowedHostnames.length > 0 && !isHostnameAllowed(hostname, allowedHostnames)) {
    return {
      safe: false,
      error: `Domain ${hostname} is not in the trusted source registry allowlist.`,
    };
  }

  // Step 6: Check if the hostname is a raw IP literal
  if (net.isIP(hostname)) {
    if (isDisallowedIP(hostname)) {
      return { safe: false, error: `Access to private or restricted IP ${hostname} is prohibited.` };
    }
    const family = net.isIPv4(hostname) ? 4 : 6;
    return { safe: true, urlObj: parsedUrl, pinnedAddresses: [{ address: hostname, family }] };
  }

  // Step 7: Resolve DNS records and verify all associated IPs
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return { safe: false, error: 'Could not resolve domain name to an IP address.' };
    }

    for (const record of addresses) {
      if (isDisallowedIP(record.address)) {
        return {
          safe: false,
          error: `Domain ${hostname} resolves to restricted address ${record.address}. Request blocked.`,
        };
      }
    }

    return { safe: true, urlObj: parsedUrl, pinnedAddresses: addresses };
  } catch (dnsErr: any) {
    return { safe: false, error: `DNS resolution failed: ${dnsErr?.message || 'Resolution error'}` };
  }
}

/**
 * Performs a hardened HTTP fetch with:
 * - Pre-verified DNS resolution & IP blocklist
 * - Connection IP pinning (lookup callback directly serves verified IPs to prevent DNS rebinding)
 * - Hostname allowlist filtering
 * - Step-by-step manual redirect inspection
 * - Response payload size limit (2MB)
 * - Strict timeout (10s)
 */
export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const maxSizeBytes = options.maxSizeBytes ?? 2 * 1024 * 1024; // 2MB max
  const timeoutMs = options.timeoutMs ?? 10000; // 10s timeout
  const allowedHostnames = options.allowedHostnames;

  let currentUrl = targetUrl;
  let redirectsFollowed = 0;

  while (redirectsFollowed <= maxRedirects) {
    // Step 1: Validate URL and DNS resolution before dispatching request
    const check = await validateUrlForSSRF(currentUrl, allowedHostnames);
    if (!check.safe || !check.urlObj || !check.pinnedAddresses || check.pinnedAddresses.length === 0) {
      throw new Error(`SSRF Block: ${check.error}`);
    }

    const parsedUrl = check.urlObj;
    const pinnedAddresses = check.pinnedAddresses;

    // Step 2: Dispatch request pinned directly to pre-verified safe IP addresses
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : defaultPort;

    const fetchResult = await new Promise<SafeFetchResult | { redirect: string }>((resolve, reject) => {
      let isSettled = false;

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const reqOptions: https.RequestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Host': parsedUrl.host,
          'User-Agent': 'HelmWarning-EvidenceAuditor/1.0 (+https://ais-pre-ryi4ymctvie4ddfhyjktyo-1072719770483.asia-southeast1.run.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.9',
          ...options.headers,
        },
        // Pin DNS resolution to pre-verified addresses only:
        // This ensures the socket connects directly to the safe IPs that passed validation,
        // making DNS rebinding attacks impossible.
        lookup: (_hostname, opts, callback) => {
          const cb = typeof opts === 'function' ? opts : callback;
          const isAll = typeof opts === 'object' && opts?.all;
          if (isAll) {
            cb(null, pinnedAddresses as any);
          } else {
            const first = pinnedAddresses[0];
            cb(null, first.address, first.family);
          }
        },
        // Set servername for TLS SNI hostname certificate verification
        servername: parsedUrl.hostname,
      };

      const req = client.request(reqOptions, (res) => {
        const statusCode = res.statusCode || 0;

        // Handle HTTP Redirects (301, 302, 303, 307, 308)
        if (statusCode >= 300 && statusCode < 400) {
          clearTimeout(timer);
          res.resume(); // Discard redirect body
          const location = res.headers.location;
          if (!location) {
            if (!isSettled) {
              isSettled = true;
              reject(new Error('Redirect returned without Location header'));
            }
            return;
          }
          if (!isSettled) {
            isSettled = true;
            resolve({ redirect: location });
          }
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          clearTimeout(timer);
          res.resume();
          if (!isSettled) {
            isSettled = true;
            reject(new Error(`Upstream server returned HTTP status ${statusCode}`));
          }
          return;
        }

        // Enforce content-length if header provided
        const contentLength = res.headers['content-length'];
        if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
          clearTimeout(timer);
          req.destroy();
          if (!isSettled) {
            isSettled = true;
            reject(new Error(`Response exceeds maximum size limit of ${maxSizeBytes} bytes`));
          }
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxSizeBytes) {
            clearTimeout(timer);
            req.destroy();
            if (!isSettled) {
              isSettled = true;
              reject(new Error(`Response payload exceeded limit of ${maxSizeBytes} bytes`));
            }
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          clearTimeout(timer);
          if (!isSettled) {
            isSettled = true;
            const fullBody = Buffer.concat(chunks).toString('utf-8');
            resolve({
              url: currentUrl,
              status: statusCode,
              contentType: (res.headers['content-type'] as string) || 'text/plain',
              data: fullBody,
            });
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      });

      req.end();
    });

    if ('redirect' in fetchResult) {
      redirectsFollowed++;
      if (redirectsFollowed > maxRedirects) {
        throw new Error(`Maximum redirect limit (${maxRedirects}) exceeded`);
      }
      currentUrl = new URL(fetchResult.redirect, currentUrl).toString();
      continue;
    }

    return fetchResult;
  }

  throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
}
