-- Delivery metadata only: never persist recipient addresses or verification codes.
CREATE TABLE IF NOT EXISTS public.auth_email_deliveries (
  event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 1 AND 128),
  owner_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  lease_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_email_deliveries_created_at_idx
  ON public.auth_email_deliveries (created_at);
ALTER TABLE public.auth_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_email_deliveries FROM PUBLIC;
DO $private_auth_email_deliveries$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anonymous', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.auth_email_deliveries FROM %I', client_role);
  END LOOP;
END;
$private_auth_email_deliveries$;
