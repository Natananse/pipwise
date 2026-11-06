import type { NeonQueryFunction } from '@neondatabase/serverless';

export type ChartReviewReservation = 'allowed' | 'account' | 'global';
const globalAccount = '__pipwise_global_photo_reviews__';

/** Shared database rows bound attempts across workers; never a process counter. */
export async function reserveChartReviewQuota(sql: NeonQueryFunction<false, false>, accountId: string, accountLimit: number, globalLimit: number): Promise<ChartReviewReservation> {
  // A separate idempotent initialization makes missing rows visible to the
  // locking statement, including when another worker creates them first.
  // Lock the identity while initializing: deletion takes FOR UPDATE on this
  // same row. An already deleted user can never recreate an orphan quota row.
  // Existing usage is included when this shared cap is introduced mid-month.
  await sql`WITH owner AS MATERIALIZED (
      SELECT id FROM neon_auth."user" WHERE id = ${accountId}::uuid FOR KEY SHARE
    ) INSERT INTO public.chart_review_usage (user_id, month_start, attempts)
    SELECT ${globalAccount}, date_trunc('month', now() AT TIME ZONE 'UTC')::date,
      COALESCE((SELECT SUM(attempts) FROM public.chart_review_usage
        WHERE month_start = date_trunc('month', now() AT TIME ZONE 'UTC')::date AND user_id <> ${globalAccount}), 0)::integer
    FROM owner
    UNION ALL SELECT owner.id::text, date_trunc('month', now() AT TIME ZONE 'UTC')::date, 0 FROM owner WHERE true
    ON CONFLICT (user_id, month_start) DO NOTHING`;
  const rows = await sql`WITH locked AS MATERIALIZED (
      SELECT user_id, month_start, attempts FROM public.chart_review_usage
      WHERE month_start = date_trunc('month', now() AT TIME ZONE 'UTC')::date
        AND user_id IN (${globalAccount}, ${accountId})
      ORDER BY user_id FOR UPDATE
    ), allowance AS MATERIALIZED (
      SELECT COUNT(*) = 2 AND BOOL_AND(attempts < CASE WHEN user_id = ${globalAccount} THEN ${globalLimit}::integer ELSE ${accountLimit}::integer END) AS allowed,
        BOOL_OR(user_id = ${globalAccount} AND attempts >= ${globalLimit}::integer) AS global_exhausted
      FROM locked
    ), counted AS (
      UPDATE public.chart_review_usage AS usage SET attempts = usage.attempts + 1
      FROM locked
      WHERE usage.user_id = locked.user_id AND usage.month_start = locked.month_start
        AND (SELECT allowed FROM allowance)
      RETURNING usage.user_id
    ) SELECT CASE WHEN (SELECT COUNT(*) FROM counted) = 2 THEN 'allowed'
      WHEN global_exhausted THEN 'global' ELSE 'account' END AS status FROM allowance`;
  const result = rows[0]?.status;
  if (result !== 'allowed' && result !== 'account' && result !== 'global') throw new Error('Quota reservation unavailable.');
  return result;
}
