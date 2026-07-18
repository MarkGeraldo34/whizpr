import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Shared Postgres client for every lib/*-store.ts module.
 *
 * Backs onto Neon (Vercel's Storage tab → Create Database → Neon, or
 * `vercel install neon`), which provisions DATABASE_URL automatically —
 * POSTGRES_URL is accepted as a fallback for Vercel's native Postgres
 * product, in case that's what's connected instead.
 *
 * Each store module calls its own idempotent `CREATE TABLE IF NOT EXISTS`
 * on first use — there's no separate migration step to run.
 *
 * The real neon() client is constructed lazily, on first query, rather than
 * at module load — Next.js imports route modules (without invoking their
 * handlers) while collecting page data at build time, and neon() throws
 * immediately if no connection string is available, which would otherwise
 * fail the production build in any environment where DATABASE_URL isn't set
 * at build time.
 */

let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set — persistent stores cannot connect to Postgres.');
    }
    // Next.js patches the global fetch() with its own caching layer, and
    // neon()'s HTTP driver executes queries via fetch() internally — without
    // an explicit opt-out, a warm serverless instance can return a cached
    // response for an identical query instead of hitting Postgres fresh.
    client = neon(connectionString, { fetchOptions: { cache: 'no-store' } });
  }
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values);
}
