-- Server-only monthly attempt quota. No screenshots or user notes are retained.
CREATE TABLE IF NOT EXISTS public.chart_review_usage (
  user_id text NOT NULL,
  month_start date NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (user_id, month_start)
);
ALTER TABLE public.chart_review_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chart_review_usage FROM PUBLIC;
DO $private_chart_review_usage$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anonymous', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.chart_review_usage FROM %I', client_role);
  END LOOP;
END;
$private_chart_review_usage$;
