/**
 * fetchWithRetry - HTTP fetch wrapper with retries, exponential backoff, and custom timeout.
 * Prevents false failures on slow or intermittently failing government endpoints.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 1, // 1 retry = 2 attempts total
  timeoutMs = 10000 // 10s default timeout for slow gov sites
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      // Non-200: only retry on 5xx (server issue), not 4xx (client/auth issue)
      if (res.status < 500 || attempt === retries) return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err; // last attempt failed, bubble up
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // backoff: 1s, 2s...
    }
  }
  throw new Error(`Unreachable target: ${url}`);
}
