import type { NeonQueryFunction } from '@neondatabase/serverless';

export type AuthEmailClaim = 'claimed' | 'sent' | 'busy';

/** A fresh owner per request prevents an expired worker from changing a new lease. */
export function createAuthEmailDelivery(sql: NeonQueryFunction<false, false>) {
  const ownerId = crypto.randomUUID();
  return {
    async claim(eventId: string): Promise<AuthEmailClaim> {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId)) throw new Error('Invalid delivery event.');
      // Retain only metadata for 30 days. Signed requests expire after five minutes.
      await sql`DELETE FROM public.auth_email_deliveries WHERE created_at < now() - interval '30 days'`;
      const claimed = await sql`INSERT INTO public.auth_email_deliveries (event_id, owner_id, status, lease_until)
        VALUES (${eventId}, ${ownerId}::uuid, 'sending', now() + interval '60 seconds')
        ON CONFLICT (event_id) DO UPDATE SET owner_id = EXCLUDED.owner_id,
          status = 'sending', lease_until = EXCLUDED.lease_until, updated_at = now()
        WHERE auth_email_deliveries.status = 'failed'
          OR (auth_email_deliveries.status = 'sending' AND auth_email_deliveries.lease_until < now())
        RETURNING event_id`;
      if (claimed.length) return 'claimed';
      // Separate statement observes a concurrent insert after ON CONFLICT waited.
      const rows = await sql`SELECT status FROM public.auth_email_deliveries WHERE event_id = ${eventId}`;
      return rows[0]?.status === 'sent' ? 'sent' : 'busy';
    },
    async complete(eventId: string): Promise<void> {
      const rows = await sql`UPDATE public.auth_email_deliveries SET status = 'sent', updated_at = now()
        WHERE event_id = ${eventId} AND owner_id = ${ownerId}::uuid AND status = 'sending'
        RETURNING event_id`;
      if (rows.length !== 1) throw new Error('Delivery acknowledgement unavailable.');
    },
    async release(eventId: string): Promise<void> {
      await sql`UPDATE public.auth_email_deliveries SET status = 'failed', updated_at = now()
        WHERE event_id = ${eventId} AND owner_id = ${ownerId}::uuid AND status = 'sending'`;
    },
  };
}
