// Local auth stand-in + actual PostgreSQL/RLS. Never sends mail or contacts Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const tables = new Set([
  "of_profiles",
  "of_applications",
  "of_application_events",
  "of_alerts",
  "of_notifications",
  "of_mail_jobs",
]);
const ident = (s) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error("Invalid test identifier");
  return s;
};
export const fixturePassword = "Fixture-password-only-2026";
export async function candidateProvider() {
  const db = new PGlite(),
    users = new Map(),
    sessions = new Map(),
    mail = [],
    calls = [];
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;`);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261118_candidate_accounts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  function session(user) {
    const n = randomUUID(),
      data = {
        user,
        access_token: "access-" + n,
        refresh_token: "refresh-" + n,
        expires_in: 3600,
      };
    sessions.set(data.access_token, data);
    sessions.set(data.refresh_token, data);
    return data;
  }
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  async function confirm(email) {
    const user = users.get(email);
    user.email_confirmed_at = new Date().toISOString();
    await db.query("UPDATE auth.users SET email_confirmed_at=$1 WHERE id=$2", [
      user.email_confirmed_at,
      user.id,
    ]);
    return user;
  }
  async function fetcher(input, options = {}) {
    const url = new URL(input),
      path = url.pathname,
      body = options.body ? JSON.parse(options.body) : {},
      method = options.method || "GET",
      token = options.headers?.Authorization?.replace("Bearer ", ""),
      auth = sessions.get(token),
      admin = options.headers?.apikey === "fixture-service-key";
    calls.push({ path, method });
    if (path === "/auth/v1/settings")
      return reply({ mailer_autoconfirm: false, disable_signup: false });
    if (path === "/auth/v1/signup") {
      if (!users.has(body.email)) {
        const user = {
          id: randomUUID(),
          email: body.email,
          user_metadata: body.data,
          email_confirmed_at: null,
          password: body.password,
        };
        users.set(body.email, user);
        await db.query("INSERT INTO auth.users VALUES($1,$2,NULL,$3)", [
          user.id,
          user.email,
          JSON.stringify(body.data),
        ]);
      }
      mail.push({ email: body.email, type: "signup" });
      return reply({ user: { email: body.email } });
    }
    if (["/auth/v1/recover", "/auth/v1/resend"].includes(path)) {
      mail.push({ email: body.email, type: "recovery" });
      return reply({});
    }
    if (path === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "refresh_token") {
        const old = sessions.get(body.refresh_token);
        if (!old) return reply({}, 401);
        sessions.delete(old.refresh_token);
        return reply(session(old.user));
      }
      const user = users.get(body.email);
      if (!user || user.password !== body.password || !user.email_confirmed_at)
        return reply({}, 400);
      return reply(session(user));
    }
    if (path === "/auth/v1/verify") {
      const user = [...users.values()].find((u) => u.id === body.token_hash);
      return user ? reply(session(await confirm(user.email))) : reply({}, 400);
    }
    if (path === "/auth/v1/user") {
      if (
        !auth ||
        !(
          await db.query("SELECT id FROM auth.users WHERE id=$1", [
            auth.user.id,
          ])
        ).rows.length
      )
        return reply({}, 401);
      if (method === "PUT") auth.user.password = body.password;
      const { password, ...safe } = auth.user;
      return reply(safe);
    }
    if (path === "/auth/v1/logout") {
      if (!auth) return reply({}, 401);
      for (const [key, s] of sessions) {
        if (
          s.user.id === auth.user.id &&
          (url.searchParams.get("scope") === "global" ||
            s.access_token === auth.access_token)
        )
          sessions.delete(key);
      }
      return reply({});
    }
    if (path.startsWith("/auth/v1/admin/users/")) {
      const user = [...users.values()].find(
        (u) => u.id === path.split("/").at(-1),
      );
      return admin && user ? reply({ user }) : reply({}, 403);
    }
    if (!path.startsWith("/rest/v1/")) return reply({}, 404);
    try {
      return await db.transaction(async (tx) => {
        await tx.exec(
          "SET LOCAL ROLE " +
            (admin ? "service_role" : auth ? "authenticated" : "anon"),
        );
        await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
          auth?.user.id || "",
        ]);
        await tx.query("SELECT set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({
            amr: [
              { method: "password", timestamp: Math.floor(Date.now() / 1000) },
            ],
          }),
        ]);
        const name = path.slice("/rest/v1/".length);
        if (name.startsWith("rpc/")) {
          const fn = ident(name.slice(4)),
            keys = Object.keys(body),
            params = keys.map((k) =>
              typeof body[k] === "object" && body[k] !== null
                ? JSON.stringify(body[k])
                : body[k],
            );
          const args = keys.map((k, i) => ident(k) + "=>$" + (i + 1)).join(",");
          const rows = (
            await tx.query(`SELECT * FROM public.${fn}(${args})`, params)
          ).rows;
          return reply(
            ["of_setup_status", "of_claim_digest", "of_admin_stats"].includes(
              fn,
            )
              ? rows[0][fn]
              : [
                    "of_track_click",
                    "of_confirm_application",
                    "of_update_application",
                  ].includes(fn)
                ? rows
                : null,
          );
        }
        if (!tables.has(name)) return reply({}, 404);
        const params = [],
          add = (value) => {
            params.push(value);
            return "$" + params.length;
          },
          where = [];
        for (const [key, value] of url.searchParams) {
          if (
            ["select", "limit", "offset", "order", "on_conflict"].includes(key)
          )
            continue;
          const dot = value.indexOf("."),
            op = value.slice(0, dot),
            v = value.slice(dot + 1);
          if (op === "eq" || op === "gt")
            where.push(ident(key) + (op === "eq" ? "=" : ">") + add(v));
          else if (op === "in")
            where.push(
              ident(key) +
                " IN (" +
                v.slice(1, -1).split(",").map(add).join(",") +
                ")",
            );
          else throw new Error("Unknown test filter");
        }
        let sql;
        if (method === "POST") {
          const list = Array.isArray(body) ? body : [body];
          if (!list.length) return reply([]);
          const keys = Object.keys(list[0]);
          sql =
            `INSERT INTO public.${name}(${keys.map(ident).join(",")}) VALUES ` +
            list
              .map(
                (row) =>
                  "(" +
                  keys
                    .map((k) =>
                      add(
                        typeof row[k] === "object" && row[k] !== null
                          ? JSON.stringify(row[k])
                          : row[k],
                      ),
                    )
                    .join(",") +
                  ")",
              )
              .join(",");
          if (url.searchParams.has("on_conflict"))
            sql +=
              " ON CONFLICT(" +
              url.searchParams
                .get("on_conflict")
                .split(",")
                .map(ident)
                .join(",") +
              ") DO NOTHING";
          sql += " RETURNING *";
        } else if (method === "PATCH") {
          sql =
            `UPDATE public.${name} SET ` +
            Object.keys(body)
              .map((k) => ident(k) + "=" + add(body[k]))
              .join(",") +
            (where.length ? " WHERE " + where.join(" AND ") : "") +
            " RETURNING *";
        } else if (method === "DELETE") {
          sql =
            `DELETE FROM public.${name}` +
            (where.length ? " WHERE " + where.join(" AND ") : "") +
            " RETURNING *";
        } else {
          sql =
            `SELECT * FROM public.${name}` +
            (where.length ? " WHERE " + where.join(" AND ") : "");
          const order = url.searchParams.get("order");
          if (order) {
            const [col, dir] = order.split(".");
            sql +=
              " ORDER BY " + ident(col) + (dir === "desc" ? " DESC" : " ASC");
          }
          sql +=
            " LIMIT " +
            Math.min(1000, Number(url.searchParams.get("limit")) || 1000) +
            " OFFSET " +
            (Number(url.searchParams.get("offset")) || 0);
        }
        const rows = (await tx.query(sql, params)).rows;
        return reply(rows);
      });
    } catch (e) {
      return reply(
        { code: e.code, message: e.message },
        e.code === "PT404" ? 404 : e.code === "PT409" ? 409 : 400,
      );
    }
  }
  return {
    db,
    users,
    mail,
    calls,
    fetcher,
    confirm,
    async addUser(email, verified = true) {
      await fetcher("https://fixture.supabase.co/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: fixturePassword,
          data: {
            first_name: "Test",
            last_name: "Local",
            app: "offres-fraiches",
          },
        }),
      });
      if (verified) await confirm(email);
      return users.get(email);
    },
    close: () => db.close(),
  };
}
