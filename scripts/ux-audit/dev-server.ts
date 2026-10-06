/**
 * Audit dev server: identical to `npm run dev` (tsx server.ts) but with Vite
 * file watching / HMR disabled.
 *
 * The UX audit scripts write screenshots and DOM snapshots into docs/ux-audit/
 * while the app is open; with the default watching dev server every write would
 * trigger a full page reload in the middle of a capture. Run the audit against
 * this entry point instead:
 *
 *   npm run dev:audit
 *
 * Note: the API rate limiter (100 requests / 15 min per IP) is in-memory and
 * resets when this process restarts.
 */
process.env.DISABLE_HMR = 'true';
await import('../../server.ts');
