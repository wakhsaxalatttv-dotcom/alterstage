-- Run in this project's Supabase SQL editor. Existing offers and auth data are not replaced.
BEGIN;
CREATE TABLE IF NOT EXISTS public.of_profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_name text NOT NULL CHECK(char_length(first_name) BETWEEN 0 AND 120),
 last_name text NOT NULL CHECK(char_length(last_name) BETWEEN 0 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 last_digest_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.of_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 offer_id text NOT NULL CHECK(char_length(offer_id) BETWEEN 1 AND 200), snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'intent' CHECK(status IN ('intent','not_applied','applied','contacted','interview','offer','hired','rejected','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(), last_clicked_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz, next_action_at timestamptz,
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=4000), UNIQUE(user_id,offer_id)
);
CREATE INDEX IF NOT EXISTS of_apps_user ON public.of_applications(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.of_application_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 application_id uuid NOT NULL REFERENCES public.of_applications(id) ON DELETE CASCADE,
 status text NOT NULL, note text NOT NULL DEFAULT '' CHECK(char_length(note)<=4000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.of_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 120), filters jsonb NOT NULL DEFAULT '{}',
 email_enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.of_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 alert_id uuid REFERENCES public.of_alerts(id) ON DELETE CASCADE,
 offer_id text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE(user_id,alert_id,offer_id)
);
CREATE INDEX IF NOT EXISTS of_notifs_user ON public.of_notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.of_daily_stats (
 day date PRIMARY KEY DEFAULT CURRENT_DATE, views bigint NOT NULL DEFAULT 0, authenticated_views bigint NOT NULL DEFAULT 0,
 outbound_clicks bigint NOT NULL DEFAULT 0, applications bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.of_daily_users (
 day date NOT NULL DEFAULT CURRENT_DATE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(day,user_id)
);
CREATE TABLE IF NOT EXISTS public.of_mail_jobs (
 id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('sending','sent','failed')), attempts integer NOT NULL DEFAULT 1,
 lease_until timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);

ALTER TABLE public.of_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_daily_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.of_mail_jobs ENABLE ROW LEVEL SECURITY;

-- Grant only the operations used by the candidate API; RLS is a second boundary.
REVOKE ALL ON public.of_profiles,public.of_applications,public.of_application_events,public.of_alerts,public.of_notifications,public.of_daily_stats,public.of_daily_users,public.of_mail_jobs FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.of_profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.of_applications,public.of_application_events,public.of_alerts,public.of_notifications TO authenticated;
GRANT ALL ON public.of_profiles,public.of_applications,public.of_application_events,public.of_alerts,public.of_notifications,public.of_daily_stats,public.of_daily_users,public.of_mail_jobs TO service_role;

DROP POLICY IF EXISTS of_profile_owner ON public.of_profiles;
CREATE POLICY of_profile_owner ON public.of_profiles FOR ALL TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
DROP POLICY IF EXISTS of_app_owner ON public.of_applications;
CREATE POLICY of_app_owner ON public.of_applications FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS of_event_owner ON public.of_application_events;
CREATE POLICY of_event_owner ON public.of_application_events FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.of_applications a WHERE a.id=application_id AND a.user_id=auth.uid()));
DROP POLICY IF EXISTS of_alert_owner ON public.of_alerts;
CREATE POLICY of_alert_owner ON public.of_alerts FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS of_notification_owner ON public.of_notifications;
CREATE POLICY of_notification_owner ON public.of_notifications FOR ALL TO authenticated USING(user_id=auth.uid())
 WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.of_alerts a WHERE a.id=alert_id AND a.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.of_setup_status() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$ SELECT jsonb_build_object('version',1); $$;
REVOKE ALL ON FUNCTION public.of_setup_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_setup_status() TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.of_record_view(p_page text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_page NOT IN ('search','companies','spotted','favorites','alerts','employers','account') THEN RETURN; END IF;
 INSERT INTO public.of_daily_stats(day,views,authenticated_views) VALUES(CURRENT_DATE,1,CASE WHEN auth.uid() IS NULL THEN 0 ELSE 1 END)
 ON CONFLICT(day) DO UPDATE SET views=public.of_daily_stats.views+1,authenticated_views=public.of_daily_stats.authenticated_views+EXCLUDED.authenticated_views;
 IF auth.uid() IS NOT NULL THEN
  INSERT INTO public.of_daily_users(day,user_id) VALUES(CURRENT_DATE,auth.uid()) ON CONFLICT DO NOTHING;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.of_record_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_record_view(text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.of_track_click(p_offer_id text,p_snapshot jsonb) RETURNS public.of_applications
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a public.of_applications;
BEGIN
 IF auth.uid() IS NULL THEN RAISE sqlstate 'PT401' USING message='Connexion requise'; END IF;
 INSERT INTO public.of_applications(user_id,offer_id,snapshot) VALUES(auth.uid(),p_offer_id,p_snapshot)
 ON CONFLICT(user_id,offer_id) DO UPDATE SET last_clicked_at=now(),updated_at=now(),
 status=CASE WHEN of_applications.status='not_applied' THEN 'intent' ELSE of_applications.status END,
 snapshot=CASE WHEN of_applications.status IN ('intent','not_applied') THEN EXCLUDED.snapshot ELSE of_applications.snapshot END
 RETURNING * INTO a;
 RETURN a;
END; $$;
REVOKE ALL ON FUNCTION public.of_track_click(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_track_click(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.of_confirm_application(p_id uuid,p_applied boolean) RETURNS public.of_applications
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a public.of_applications;
BEGIN
 SELECT * INTO a FROM public.of_applications WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE sqlstate 'PT404' USING message='Candidature introuvable'; END IF;
 IF a.status<>'intent' THEN RAISE sqlstate 'PT409' USING message='Cette candidature a déjà été renseignée'; END IF;
 UPDATE public.of_applications SET status=CASE WHEN p_applied THEN 'applied' ELSE 'not_applied' END,
 applied_at=CASE WHEN p_applied THEN now() ELSE NULL END,updated_at=now() WHERE id=p_id RETURNING * INTO a;
 INSERT INTO public.of_application_events(user_id,application_id,status,note) VALUES(auth.uid(),p_id,a.status,'Confirmation du candidat');
 RETURN a;
END; $$;
REVOKE ALL ON FUNCTION public.of_confirm_application(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_confirm_application(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.of_update_application(p_id uuid,p_status text,p_note text,p_next_action_at timestamptz) RETURNS public.of_applications
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a public.of_applications;
BEGIN
 IF p_status NOT IN ('applied','contacted','interview','offer','hired','rejected','withdrawn') OR char_length(p_note)>4000 THEN RAISE sqlstate 'PT400' USING message='État ou note invalide'; END IF;
 SELECT * INTO a FROM public.of_applications WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE sqlstate 'PT404' USING message='Candidature introuvable'; END IF;
 IF a.status IN ('intent','not_applied') THEN RAISE sqlstate 'PT409' USING message='Confirmez d’abord avoir postulé'; END IF;
 UPDATE public.of_applications SET status=p_status,note=p_note,next_action_at=p_next_action_at,updated_at=now() WHERE id=p_id RETURNING * INTO a;
 INSERT INTO public.of_application_events(user_id,application_id,status,note) VALUES(auth.uid(),p_id,p_status,p_note);
 RETURN a;
END; $$;
REVOKE ALL ON FUNCTION public.of_update_application(uuid,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_update_application(uuid,text,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.of_admin_stats() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object(
  'accounts',(SELECT count(*) FROM auth.users u WHERE u.raw_user_meta_data->>'app'='offres-fraiches' OR EXISTS(SELECT 1 FROM public.of_profiles p WHERE p.id=u.id)),
  'verifiedAccounts',(SELECT count(*) FROM auth.users u JOIN public.of_profiles p ON p.id=u.id WHERE u.email_confirmed_at IS NOT NULL),
  'applications',(SELECT count(*) FROM public.of_applications WHERE status NOT IN ('intent','not_applied')),
  'daily',COALESCE((SELECT jsonb_agg(x ORDER BY x.day DESC) FROM (SELECT s.*, (SELECT count(*) FROM public.of_daily_users d WHERE d.day=s.day) AS authenticated_users FROM public.of_daily_stats s WHERE s.day>=CURRENT_DATE-30) x),'[]'::jsonb)
 ); $$;
REVOKE ALL ON FUNCTION public.of_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_admin_stats() TO service_role;

CREATE OR REPLACE FUNCTION public.of_delete_my_account() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE sqlstate 'PT401' USING message='Connexion requise'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr','[]'::jsonb)) a
  WHERE a->>'method'='password' AND to_timestamp((a->>'timestamp')::double precision)>now()-interval '5 minutes')
 THEN RAISE sqlstate 'PT403' USING message='Une connexion récente avec votre mot de passe est nécessaire'; END IF;
 DELETE FROM auth.users WHERE id=auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.of_delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_delete_my_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.of_count_action(p_action text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR p_action NOT IN ('click','application') THEN RETURN; END IF;
 INSERT INTO public.of_daily_stats(day,outbound_clicks,applications)
 VALUES(CURRENT_DATE,CASE WHEN p_action='click' THEN 1 ELSE 0 END,CASE WHEN p_action='application' THEN 1 ELSE 0 END)
 ON CONFLICT(day) DO UPDATE SET outbound_clicks=of_daily_stats.outbound_clicks+EXCLUDED.outbound_clicks,applications=of_daily_stats.applications+EXCLUDED.applications;
END; $$;
REVOKE ALL ON FUNCTION public.of_count_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_count_action(text) TO authenticated;

-- Service-only, leased jobs for daily opt-in alert emails. Candidate tokens cannot call this.
CREATE OR REPLACE FUNCTION public.of_claim_digest(p_user uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE claimed text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.of_profiles WHERE id=p_user AND last_digest_at>now()-interval '24 hours') THEN RETURN false; END IF;
 INSERT INTO public.of_mail_jobs(id,user_id,status,lease_until) VALUES(p_user::text||':'||CURRENT_DATE::text,p_user,'sending',now()+interval '15 minutes')
 ON CONFLICT(id) DO UPDATE SET status='sending',attempts=of_mail_jobs.attempts+1,lease_until=EXCLUDED.lease_until
 WHERE of_mail_jobs.status<>'sent' AND of_mail_jobs.attempts<3 AND of_mail_jobs.lease_until<now()
 RETURNING id INTO claimed;
 RETURN claimed IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.of_claim_digest(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.of_claim_digest(uuid) TO service_role;

-- Enforce the per-account cap even if a client calls PostgREST directly.
CREATE OR REPLACE FUNCTION public.of_limit_alerts() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF (SELECT count(*) FROM public.of_alerts WHERE user_id=NEW.user_id)>=20 THEN
  RAISE sqlstate 'PT400' USING message='Maximum de 20 alertes atteint';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.of_limit_alerts() FROM PUBLIC;
DROP TRIGGER IF EXISTS of_limit_alerts ON public.of_alerts;
CREATE TRIGGER of_limit_alerts BEFORE INSERT ON public.of_alerts FOR EACH ROW EXECUTE FUNCTION public.of_limit_alerts();
CREATE INDEX IF NOT EXISTS of_events_user_app ON public.of_application_events(user_id,application_id,created_at DESC);
CREATE INDEX IF NOT EXISTS of_alerts_user ON public.of_alerts(user_id,created_at DESC);

COMMIT;
