import type { NeonQueryFunction } from '@neondatabase/serverless';

/** Preview the cleanup without reading or returning feedback contents. */
export async function countExpiredFeedback(sql: NeonQueryFunction<false, false>): Promise<number> {
  const rows = await sql`SELECT count(*)::integer AS eligible FROM public.beta_feedback WHERE created_at <= now() - interval '12 months'`;
  const eligible = rows[0]?.eligible;
  if (typeof eligible !== 'number' || !Number.isInteger(eligible) || eligible < 0) throw new Error('Feedback retention preview did not complete.');
  return eligible;
}

/** Server/maintenance only: delete support feedback beyond the retention policy. */
export async function purgeExpiredFeedback(sql: NeonQueryFunction<false, false>): Promise<number> {
  const rows = await sql`
    WITH expired AS (
      DELETE FROM public.beta_feedback
      WHERE created_at <= now() - interval '12 months'
      RETURNING 1
    ) SELECT count(*)::integer AS removed FROM expired
  `;
  const removed = rows[0]?.removed;
  if (typeof removed !== 'number' || !Number.isInteger(removed) || removed < 0) throw new Error('Feedback retention cleanup did not complete.');
  return removed;
}
