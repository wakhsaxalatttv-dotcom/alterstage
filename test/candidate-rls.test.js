import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
test("PostgreSQL: migration, RLS isolation, confirmation, history, export boundaries, digest and deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO anon,authenticated,service_role;
 INSERT INTO auth.users VALUES('${a}','a@example.org',now(),'{}'),('${b}','b@example.org',now(),'{}');`);
    const sql = await readFile(
      new URL(
        "../supabase/migrations/20261118_candidate_accounts.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql); // idempotent deployment
    const as = async (role, id = "") => {
      await db.exec(
        `RESET ROLE; SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${id}',false); SELECT set_config('request.jwt.claims','{}',false);`,
      );
    };
    await as("anon");
    assert.equal(
      (await db.query("SELECT public.of_setup_status() AS v")).rows[0].v
        .version,
      1,
    );
    await assert.rejects(
      db.query("SELECT * FROM public.of_profiles"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("SELECT public.of_admin_stats()"),
      /permission denied/,
    );
    await as("authenticated", a);
    await db.query(
      "INSERT INTO public.of_profiles(id,first_name,last_name) VALUES($1,$2,$3)",
      [a, "Alice", "Test"],
    );
    const click = () =>
      db.query("SELECT * FROM public.of_track_click($1,$2::jsonb)", [
        "fixture-offer",
        JSON.stringify({ title: "Offre fictive", company: { name: "Test" } }),
      ]);
    const row = (await click()).rows[0];
    assert.equal(row.status, "intent");
    assert.equal((await click()).rows[0].id, row.id);
    await assert.rejects(
      db.query("SELECT public.of_update_application($1,$2,$3,NULL)", [
        row.id,
        "interview",
        "",
      ]),
      /Confirmez/,
    );
    assert.equal(
      (
        await db.query("SELECT * FROM public.of_confirm_application($1,true)", [
          row.id,
        ])
      ).rows[0].status,
      "applied",
    );
    await assert.rejects(
      db.query("SELECT public.of_confirm_application($1,true)", [row.id]),
      /déjà/,
    );
    assert.equal((await click()).rows[0].status, "applied");
    await db.query("SELECT public.of_update_application($1,$2,$3,now())", [
      row.id,
      "interview",
      "Appel reçu",
    ]);
    assert.equal(
      (await db.query("SELECT * FROM public.of_application_events")).rows
        .length,
      2,
    );
    const alert = (
      await db.query(
        "INSERT INTO public.of_alerts(user_id,name) VALUES($1,$2) RETURNING *",
        [a, "Recherche test"],
      )
    ).rows[0];
    assert.equal(alert.email_enabled, false);
    await as("authenticated", b);
    assert.deepEqual(
      (await db.query("SELECT * FROM public.of_applications")).rows,
      [],
    );
    assert.deepEqual(
      (await db.query("SELECT * FROM public.of_profiles")).rows,
      [],
    );
    assert.deepEqual(
      (await db.query("SELECT * FROM public.of_application_events")).rows,
      [],
    );
    await assert.rejects(
      db.query("SELECT public.of_confirm_application($1,true)", [row.id]),
      /introuvable/,
    );
    await db.query("UPDATE public.of_applications SET note=$1 WHERE id=$2", [
      "Intrusion",
      row.id,
    ]);
    await assert.rejects(
      db.query(
        "INSERT INTO public.of_applications(user_id,offer_id,snapshot) VALUES($1,$2,$3)",
        [a, "forged", "{}"],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO public.of_application_events(user_id,application_id,status) VALUES($1,$2,$3)",
        [b, row.id, "hired"],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO public.of_notifications(user_id,alert_id,offer_id,snapshot) VALUES($1,$2,$3,$4)",
        [b, alert.id, "forged", "{}"],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("SELECT public.of_claim_digest($1)", [b]),
      /permission denied/,
    );
    await as("authenticated", a);
    assert.equal(
      (
        await db.query("SELECT note FROM public.of_applications WHERE id=$1", [
          row.id,
        ])
      ).rows[0].note,
      "Appel reçu",
    );
    for (let i = 1; i < 20; i++)
      await db.query(
        "INSERT INTO public.of_alerts(user_id,name) VALUES($1,$2)",
        [a, "Recherche " + i],
      );
    await assert.rejects(
      db.query("INSERT INTO public.of_alerts(user_id,name) VALUES($1,$2)", [
        a,
        "Excès",
      ]),
      /Maximum/,
    );
    await db.query("SELECT public.of_record_view($1)", ["account"]);
    await db.query("SELECT public.of_record_view($1)", ["account"]);
    await as("service_role");
    assert.equal(
      (await db.query("SELECT public.of_claim_digest($1) AS v", [a])).rows[0].v,
      true,
    );
    assert.equal(
      (await db.query("SELECT public.of_claim_digest($1) AS v", [a])).rows[0].v,
      false,
    );
    const stats = (await db.query("SELECT public.of_admin_stats() AS v"))
      .rows[0].v;
    assert.equal(stats.daily[0].views, 2);
    assert.equal(stats.daily[0].authenticated_users, 1);
    await as("authenticated", a);
    await assert.rejects(
      db.query("SELECT public.of_delete_my_account()"),
      /connexion récente/,
    );
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
      }),
    ]);
    await db.query("SELECT public.of_delete_my_account()");
    await as("service_role");
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM public.of_applications"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM public.of_alerts")).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
