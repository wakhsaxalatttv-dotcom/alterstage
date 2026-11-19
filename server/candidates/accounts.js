import express from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { candidateClient, CandidateError } from "./supabase.js";
import { candidateMailer } from "./mailer.js";
import { fixedWindowLimiter } from "../security.js";
import { safeUrl, publicOffer } from "../domain.js";
import { selectOffers, defaultFilters } from "../../src/domain.js";
import { domains, contracts } from "../../shared/catalog.js";
import { regions } from "../../src/domain.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const nonce = () => randomBytes(32).toString("base64url");
const isPassword = (s) =>
  typeof s === "string" &&
  s.length >= 12 &&
  s.length <= 128 &&
  Buffer.byteLength(s) <= 512;
const emailOf = (value) => {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new CandidateError("Adresse e-mail invalide.");
  return s;
};
const nameOf = (value) => {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s || s.length > 120 || /[\x00-\x1f]/.test(s))
    throw new CandidateError("Renseignez votre prénom et votre nom.");
  return s;
};
const uuid = (value) => {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new CandidateError("Identifiant invalide.");
  return value;
};
const filterKeys = [
  "query",
  "city",
  "region",
  "domain",
  "contract",
  "tech",
  "group",
  "companyId",
  "education",
  "age",
];
function alertFilters(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CandidateError("Filtres invalides.");
  const filters = {};
  for (const key of filterKeys)
    if (input[key]) {
      if (typeof input[key] !== "string" || input[key].length > 200)
        throw new CandidateError("Filtre invalide.");
      filters[key] = input[key].trim();
    }
  if (filters.domain && !domains.includes(filters.domain))
    throw new CandidateError("Domaine invalide.");
  if (filters.contract && !contracts.includes(filters.contract))
    throw new CandidateError("Contrat invalide.");
  if (filters.region && !Object.hasOwn(regions, filters.region))
    throw new CandidateError("Région invalide.");
  return filters;
}
const snapshotOf = (o) => ({
  id: o.id,
  title: String(o.title).slice(0, 180),
  company: {
    name: o.company.name,
    logoUrl: o.company.logoUrl || null,
    website: o.company.website || null,
  },
  location: o.location,
  domain: o.domain,
  contract: o.contract,
  applicationUrl: safeUrl(o.applicationUrl || o.sourceUrl),
  sourceUrl: safeUrl(o.sourceUrl),
  publishedAt: o.publishedAt,
});
const cleanApplication = (row) => ({
  ...row,
  snapshot: {
    ...row.snapshot,
    applicationUrl: safeUrl(row.snapshot?.applicationUrl),
    sourceUrl: safeUrl(row.snapshot?.sourceUrl),
  },
});
const rowOf = (result) => (Array.isArray(result) ? result[0] : result);

export function mountCandidateAccounts(
  app,
  { store, reports, admin, ...options },
) {
  const client = candidateClient(options),
    env = client.env;
  const enabled = options.enabled ?? env.CANDIDATE_ACCOUNTS_ENABLED === "true";
  const mailer = options.mailer || candidateMailer(env);
  const secureCookies =
    options.secureCookies ??
    (env.RENDER === "true" || env.NODE_ENV === "production");
  const prefix = secureCookies ? "__Host-of_" : "of_";
  const cookieNames = {
    access: prefix + "access",
    refresh: prefix + "refresh",
    csrf: prefix + "csrf",
    recovery: prefix + "recovery",
  };
  const router = express.Router();
  const loginLimit = fixedWindowLimiter({ limit: 12, windowMs: 15 * 60000 });
  const mailLimit = fixedWindowLimiter({ limit: 5, windowMs: 3600000 });
  const mailAddressLimit = fixedWindowLimiter({ limit: 3, windowMs: 3600000 });
  const writeLimit = fixedWindowLimiter({ limit: 120, windowMs: 60000 });
  const viewLimit = fixedWindowLimiter({ limit: 30, windowMs: 60000 });
  let setup = null,
    setupChecked = 0,
    checking,
    working = null,
    workerTimer = null;
  const result = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      res.status(e instanceof CandidateError ? e.status : 503).json({
        message:
          e instanceof CandidateError
            ? e.message
            : "Le service des comptes est temporairement indisponible.",
      });
    }
  };
  function limited(limiter, key) {
    const retry = limiter.consume(key);
    if (retry)
      throw new CandidateError("Trop de demandes. Réessayez plus tard.", 429);
  }
  function cookies(req) {
    const parsed = {};
    for (const item of (req.headers.cookie || "").split(";")) {
      const i = item.indexOf("=");
      if (i > 0) {
        try {
          parsed[item.slice(0, i).trim()] = decodeURIComponent(
            item.slice(i + 1),
          );
        } catch {}
      }
    }
    return parsed;
  }
  function putCookie(res, name, value, seconds) {
    res.append(
      "Set-Cookie",
      `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secureCookies ? "; Secure" : ""}`,
    );
  }
  function clearCookies(res) {
    for (const name of Object.values(cookieNames)) putCookie(res, name, "", 0);
  }
  function setSession(res, session, { recovery = false, csrf = nonce() } = {}) {
    putCookie(
      res,
      cookieNames.access,
      session.access_token,
      Math.min(Number(session.expires_in) || 3600, 3600),
    );
    putCookie(res, cookieNames.refresh, session.refresh_token, 7 * 86400);
    putCookie(res, cookieNames.csrf, csrf, 7 * 86400);
    putCookie(
      res,
      cookieNames.recovery,
      recovery ? hash(session.refresh_token) : "",
      recovery ? 3600 : 0,
    );
    return csrf;
  }
  async function status() {
    if (!enabled) return { enabled: false, emailAlertsEnabled: false };
    if (setup && Date.now() - setupChecked < (setup.enabled ? 300000 : 15000))
      return setup;
    if (checking) return checking;
    checking = (async () => {
      try {
        const [schema, auth] = await Promise.all([
          client.rpc("of_setup_status", {}),
          client.call("/auth/v1/settings"),
        ]);
        setup = {
          enabled: schema?.version === 1,
          registrationEnabled:
            schema?.version === 1 &&
            auth.mailer_autoconfirm === false &&
            auth.disable_signup !== true,
          emailAlertsEnabled: mailer.ready && client.hasServiceKey,
        };
      } catch {
        setup = {
          enabled: false,
          registrationEnabled: false,
          emailAlertsEnabled: false,
        };
      }
      setupChecked = Date.now();
      return setup;
    })().finally(() => {
      checking = null;
    });
    return checking;
  }
  async function requireReady() {
    if (!(await status()).enabled)
      throw new CandidateError(
        "Les comptes sont momentanément indisponibles.",
        503,
      );
  }
  async function session(req, res, required = true) {
    const c = cookies(req),
      access = c[cookieNames.access],
      refresh = c[cookieNames.refresh];
    let token = access,
      user;
    if (access) {
      try {
        user = await client.call("/auth/v1/user", { token });
      } catch (e) {
        if (![400, 401, 403].includes(e.status)) throw e;
      }
    }
    if (!user && refresh) {
      try {
        const fresh = await client.call(
          "/auth/v1/token?grant_type=refresh_token",
          { method: "POST", body: { refresh_token: refresh } },
        );
        if (
          !fresh.user?.email_confirmed_at ||
          !fresh.access_token ||
          !fresh.refresh_token
        )
          throw new CandidateError("Confirmez votre adresse e-mail.", 403);
        const isRecovery = c[cookieNames.recovery] === hash(refresh);
        setSession(res, fresh, {
          csrf: c[cookieNames.csrf] || nonce(),
          recovery: isRecovery,
        });
        token = fresh.access_token;
        user = fresh.user;
      } catch (e) {
        if (e.status === 503) throw e;
        clearCookies(res);
      }
    }
    if (!user?.id || !user.email_confirmed_at) {
      if (required)
        throw new CandidateError(
          "Connectez-vous avec une adresse e-mail confirmée.",
          401,
        );
      return null;
    }
    let csrf = c[cookieNames.csrf];
    if (!csrf) {
      csrf = nonce();
      putCookie(res, cookieNames.csrf, csrf, 7 * 86400);
    }
    return {
      user,
      token,
      csrf,
      recovery: Boolean(
        c[cookieNames.refresh] &&
        c[cookieNames.recovery] === hash(c[cookieNames.refresh]),
      ),
    };
  }
  function csrfCheck(req) {
    const c = cookies(req)[cookieNames.csrf] || "",
      h = req.get("X-CSRF-Token") || "";
    const a = Buffer.from(c),
      b = Buffer.from(h);
    if (a.length < 32 || a.length !== b.length || !timingSafeEqual(a, b))
      throw new CandidateError(
        "La session doit être actualisée avant cette action.",
        403,
      );
  }
  async function profile(auth) {
    const rows = await client.rest(
      "of_profiles?select=*&id=eq." + auth.user.id,
      { token: auth.token },
    );
    if (rows.length) return rows[0];
    const metadata = auth.user.user_metadata || {};
    const body = {
      id: auth.user.id,
      first_name: String(metadata.first_name || "").slice(0, 120),
      last_name: String(metadata.last_name || "").slice(0, 120),
    };
    const inserted = await client.rest("of_profiles?on_conflict=id", {
      token: auth.token,
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body,
    });
    return inserted[0] || body;
  }
  async function me(auth) {
    const p = await profile(auth);
    return {
      id: auth.user.id,
      email: auth.user.email,
      firstName: p.first_name,
      lastName: p.last_name,
      verifiedAt: auth.user.email_confirmed_at,
    };
  }
  async function signed(req, res, fn) {
    await requireReady();
    const auth = await session(req, res);
    if (!["GET", "HEAD"].includes(req.method)) {
      csrfCheck(req);
      limited(writeLimit, auth.user.id);
    }
    await fn(auth);
  }
  const authReply =
    "Si cette adresse peut être utilisée, vous recevrez un message. Vérifiez aussi les courriers indésirables. Si le compte existe déjà, utilisez la connexion ou la récupération du mot de passe.";
  async function authMailRate(req, email) {
    limited(mailLimit, req.ip);
    limited(mailAddressLimit, hash(email));
  }
  const redirect = "/compte";
  router.get(
    "/config",
    result(async (_req, res) => res.json(await status())),
  );
  router.get(
    "/me",
    result(async (req, res) => {
      if (!(await status()).enabled)
        return res.json({ user: null, enabled: false });
      const auth = await session(req, res, false);
      res.json({
        enabled: true,
        user: auth ? await me(auth) : null,
        csrf: auth?.csrf || null,
        recovery: auth?.recovery || false,
      });
    }),
  );
  router.post(
    "/register",
    result(async (req, res) => {
      await requireReady();
      if (!(await status()).registrationEnabled)
        throw new CandidateError(
          "Les inscriptions sont momentanément indisponibles.",
          503,
        );
      const b = req.body || {},
        email = emailOf(b.email);
      await authMailRate(req, email);
      const first = nameOf(b.firstName),
        last = nameOf(b.lastName);
      if (!isPassword(b.password) || b.acceptPrivacy !== true)
        throw new CandidateError(
          "Choisissez un mot de passe de 12 à 128 caractères et prenez connaissance des informations sur vos données.",
        );
      try {
        await client.call(
          "/auth/v1/signup?redirect_to=" +
            encodeURIComponent(client.siteUrl + redirect),
          {
            method: "POST",
            body: {
              email,
              password: b.password,
              data: {
                first_name: first,
                last_name: last,
                app: "offres-fraiches",
                privacy_notice_version: "2026-11-18",
                privacy_notice_acknowledged_at: new Date().toISOString(),
              },
            },
          },
        );
      } catch (e) {
        if (e.status === 503 || e.status === 429) throw e;
      }
      res.status(202).json({ message: authReply });
    }),
  );
  router.post(
    "/login",
    result(async (req, res) => {
      await requireReady();
      limited(loginLimit, req.ip);
      const b = req.body || {},
        email = emailOf(b.email);
      if (typeof b.password !== "string" || b.password.length > 128)
        throw new CandidateError("Adresse ou mot de passe incorrect.", 401);
      let data;
      try {
        data = await client.call("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email, password: b.password },
        });
      } catch (e) {
        if (e.status === 503 || e.status === 429) throw e;
        throw new CandidateError(
          "Adresse ou mot de passe incorrect, ou adresse e-mail non confirmée.",
          401,
        );
      }
      if (
        !data.user?.email_confirmed_at ||
        !data.access_token ||
        !data.refresh_token
      )
        throw new CandidateError(
          "Confirmez votre adresse e-mail avant de vous connecter.",
          403,
        );
      const csrf = setSession(res, data);
      const auth = { user: data.user, token: data.access_token };
      res.json({ user: await me(auth), csrf });
    }),
  );
  router.post(
    "/recover",
    result(async (req, res) => {
      await requireReady();
      const email = emailOf(req.body?.email);
      await authMailRate(req, email);
      try {
        await client.call(
          "/auth/v1/recover?redirect_to=" +
            encodeURIComponent(client.siteUrl + redirect),
          { method: "POST", body: { email } },
        );
      } catch (e) {
        if (e.status === 503 || e.status === 429) throw e;
      }
      res.status(202).json({ message: authReply });
    }),
  );
  router.post(
    "/resend",
    result(async (req, res) => {
      await requireReady();
      const email = emailOf(req.body?.email);
      await authMailRate(req, email);
      try {
        await client.call(
          "/auth/v1/resend?redirect_to=" +
            encodeURIComponent(client.siteUrl + redirect),
          { method: "POST", body: { email, type: "signup" } },
        );
      } catch (e) {
        if (e.status === 503 || e.status === 429) throw e;
      }
      res.status(202).json({ message: authReply });
    }),
  );
  router.post(
    "/session",
    result(async (req, res) => {
      await requireReady();
      limited(loginLimit, req.ip);
      const b = req.body || {};
      let data;
      if (b.tokenHash && ["email", "signup", "recovery"].includes(b.type)) {
        if (typeof b.tokenHash !== "string" || b.tokenHash.length > 512)
          throw new CandidateError("Lien invalide.");
        data = await client.call("/auth/v1/verify", {
          method: "POST",
          body: { token_hash: b.tokenHash, type: b.type },
        });
      } else if (
        typeof b.refreshToken === "string" &&
        b.refreshToken.length >= 10 &&
        b.refreshToken.length <= 4096
      ) {
        // The refresh grant is validated by Supabase; no arbitrary JWT is trusted.
        data = await client.call("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: { refresh_token: b.refreshToken },
        });
      } else throw new CandidateError("Lien invalide ou expiré.");
      if (
        !data.user?.email_confirmed_at ||
        !data.access_token ||
        !data.refresh_token
      )
        throw new CandidateError(
          "L’adresse e-mail n’a pas pu être confirmée.",
          403,
        );
      const csrf = setSession(res, data, { recovery: b.type === "recovery" });
      res.json({
        user: await me({ user: data.user, token: data.access_token }),
        csrf,
        recovery: b.type === "recovery",
      });
    }),
  );
  router.post(
    "/logout",
    result(async (req, res) => {
      csrfCheck(req);
      // Local sign-out remains possible even during an identity-provider outage.
      try {
        const auth = await session(req, res, false);
        if (auth)
          await client.call("/auth/v1/logout?scope=local", {
            method: "POST",
            token: auth.token,
          });
      } catch {
        /* Revocation is best effort; browser credentials are always removed. */
      } finally {
        clearCookies(res);
      }
      res.json({ ok: true });
    }),
  );
  router.post(
    "/password",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const b = req.body || {};
        if (!isPassword(b.password))
          throw new CandidateError(
            "Le nouveau mot de passe doit contenir de 12 à 128 caractères.",
          );
        let token = auth.token;
        if (!auth.recovery) {
          if (
            typeof b.currentPassword !== "string" ||
            b.currentPassword.length > 128
          )
            throw new CandidateError("Renseignez votre mot de passe actuel.");
          const fresh = await client.call(
            "/auth/v1/token?grant_type=password",
            {
              method: "POST",
              body: { email: auth.user.email, password: b.currentPassword },
            },
          );
          token = fresh.access_token;
        }
        await client.call("/auth/v1/user", {
          method: "PUT",
          token,
          body: { password: b.password },
        });
        await client.call("/auth/v1/logout?scope=global", {
          method: "POST",
          token,
        });
        clearCookies(res);
        res.json({ message: "Mot de passe modifié. Reconnectez-vous." });
      }),
    ),
  );
  router.patch(
    "/profile",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const body = {
          first_name: nameOf(req.body?.firstName),
          last_name: nameOf(req.body?.lastName),
        };
        await client.rest("of_profiles?id=eq." + auth.user.id, {
          method: "PATCH",
          token: auth.token,
          body,
        });
        res.json({ user: await me(auth) });
      }),
    ),
  );
  router.get(
    "/applications",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const page = Math.max(
          1,
          Math.min(10000, Number.parseInt(req.query.page, 10) || 1),
        );
        const rows = await client.rest(
          "of_applications?select=*" +
            (req.query.pending === "true" ? "&status=eq.intent" : "") +
            "&order=updated_at.desc&limit=31&offset=" +
            (page - 1) * 30,
          { token: auth.token },
        );
        res.json({
          applications: rows.slice(0, 30).map(cleanApplication),
          page,
          hasMore: rows.length > 30,
        });
      }),
    ),
  );
  router.post(
    "/click",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const id = req.body?.offerId;
        if (typeof id !== "string" || id.length > 200)
          throw new CandidateError("Offre invalide.");
        const offer =
          (await store.getPublic(id)) ||
          reports.references().find((o) => o.id === id);
        if (!offer)
          throw new CandidateError("Cette offre n’est plus disponible.", 404);
        const normalized = offer.summary
          ? {
              ...offer,
              company: { ...offer.company, website: offer.companyWebsite },
              applicationUrl: offer.applicationUrl || offer.sourceUrl,
            }
          : offer;
        const application = rowOf(
          await client.rpc(
            "of_track_click",
            { p_offer_id: id, p_snapshot: snapshotOf(normalized) },
            { token: auth.token },
          ),
        );
        await client.rpc(
          "of_count_action",
          { p_action: "click" },
          { token: auth.token },
        );
        res.json({ application: cleanApplication(application) });
      }),
    ),
  );
  router.post(
    "/applications/:id/confirm",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const id = uuid(req.params.id);
        if (typeof req.body?.applied !== "boolean")
          throw new CandidateError("Confirmez si vous avez postulé.");
        const row = rowOf(
          await client.rpc(
            "of_confirm_application",
            { p_id: id, p_applied: req.body.applied },
            { token: auth.token },
          ),
        );
        if (req.body.applied)
          await client.rpc(
            "of_count_action",
            { p_action: "application" },
            { token: auth.token },
          );
        res.json({ application: cleanApplication(row) });
      }),
    ),
  );
  router.patch(
    "/applications/:id",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const b = req.body || {};
        const note = typeof b.note === "string" ? b.note : "";
        if (note.length > 4000)
          throw new CandidateError("La note est limitée à 4 000 caractères.");
        if (
          ![
            "applied",
            "contacted",
            "interview",
            "offer",
            "hired",
            "rejected",
            "withdrawn",
          ].includes(b.status)
        )
          throw new CandidateError("État invalide.");
        if (b.nextActionAt && !Number.isFinite(Date.parse(b.nextActionAt)))
          throw new CandidateError("Date de suivi invalide.");
        const row = rowOf(
          await client.rpc(
            "of_update_application",
            {
              p_id: uuid(req.params.id),
              p_status: b.status,
              p_note: note,
              p_next_action_at: b.nextActionAt
                ? new Date(b.nextActionAt).toISOString()
                : null,
            },
            { token: auth.token },
          ),
        );
        res.json({ application: cleanApplication(row) });
      }),
    ),
  );
  router.get(
    "/applications/:id/events",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        res.json({
          events: await client.rest(
            "of_application_events?select=*&application_id=eq." +
              uuid(req.params.id) +
              "&order=created_at.desc",
            { token: auth.token },
          ),
        });
      }),
    ),
  );
  router.get(
    "/alerts",
    result(async (req, res) =>
      signed(req, res, async (auth) =>
        res.json({
          alerts: await client.rest(
            "of_alerts?select=*&order=created_at.desc",
            { token: auth.token },
          ),
        }),
      ),
    ),
  );
  router.post(
    "/alerts",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const old = await client.rest("of_alerts?select=id", {
          token: auth.token,
        });
        if (old.length >= 20)
          throw new CandidateError(
            "Vous pouvez enregistrer jusqu’à 20 alertes.",
          );
        const emailEnabled = req.body?.emailEnabled === true;
        if (emailEnabled && !(await status()).emailAlertsEnabled)
          throw new CandidateError(
            "Les alertes e-mail sont momentanément indisponibles.",
            503,
          );
        const body = {
          user_id: auth.user.id,
          name: nameOf(req.body?.name || "Stages et alternances"),
          filters: alertFilters(req.body?.filters),
          email_enabled: emailEnabled,
        };
        const rows = await client.rest("of_alerts", {
          method: "POST",
          token: auth.token,
          headers: { Prefer: "return=representation" },
          body,
        });
        res.status(201).json({ alert: rows[0] });
      }),
    ),
  );
  router.patch(
    "/alerts/:id",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const enabled = req.body?.emailEnabled === true;
        if (enabled && !(await status()).emailAlertsEnabled)
          throw new CandidateError(
            "Les alertes e-mail sont momentanément indisponibles.",
            503,
          );
        await client.rest("of_alerts?id=eq." + uuid(req.params.id), {
          method: "PATCH",
          token: auth.token,
          body: { email_enabled: enabled },
        });
        res.json({ ok: true });
      }),
    ),
  );
  router.delete(
    "/alerts/:id",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        await client.rest("of_alerts?id=eq." + uuid(req.params.id), {
          method: "DELETE",
          token: auth.token,
        });
        res.json({ ok: true });
      }),
    ),
  );
  async function matchAlerts({ token, admin = false, userId }) {
    const alerts = await client.all(
      "of_alerts?select=*" + (userId ? "&user_id=eq." + uuid(userId) : ""),
      { token, admin },
    );
    let created = 0;
    const publicOffers = (await store.read())
      .map((o) => publicOffer(o))
      .filter(Boolean);
    for (const alert of alerts) {
      const matches = selectOffers(publicOffers, {
        ...defaultFilters,
        ...alertFilters(alert.filters),
      }).filter(
        (o) => Date.parse(o.firstRetrievedAt) > Date.parse(alert.created_at),
      );
      for (let offset = 0; offset < matches.length; offset += 100) {
        const body = matches.slice(offset, offset + 100).map((offer) => ({
          user_id: alert.user_id,
          alert_id: alert.id,
          offer_id: offer.id,
          snapshot: snapshotOf(offer),
        }));
        const rows = await client.rest(
          "of_notifications?on_conflict=user_id,alert_id,offer_id",
          {
            method: "POST",
            token,
            admin,
            headers: {
              Prefer: "resolution=ignore-duplicates,return=representation",
            },
            body,
          },
        );
        created += rows?.length || 0;
      }
    }
    return created;
  }
  router.post(
    "/alerts/check",
    result(async (req, res) =>
      signed(req, res, async (auth) =>
        res.json({
          created: await matchAlerts({
            token: auth.token,
            userId: auth.user.id,
          }),
        }),
      ),
    ),
  );
  router.get(
    "/notifications",
    result(async (req, res) =>
      signed(req, res, async (auth) =>
        res.json({
          notifications: await client.rest(
            "of_notifications?select=*&order=created_at.desc&limit=100",
            { token: auth.token },
          ),
        }),
      ),
    ),
  );
  router.post(
    "/notifications/:id/read",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        await client.rest("of_notifications?id=eq." + uuid(req.params.id), {
          method: "PATCH",
          token: auth.token,
          body: { read_at: new Date().toISOString() },
        });
        res.json({ ok: true });
      }),
    ),
  );
  router.get(
    "/export",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const data = { profile: await me(auth) };
        for (const table of [
          "of_applications",
          "of_application_events",
          "of_alerts",
          "of_notifications",
        ])
          data[table] = await client.all(table + "?select=*", {
            token: auth.token,
          });
        res
          .set(
            "Content-Disposition",
            'attachment; filename="offres-fraiches-mes-donnees.json"',
          )
          .json(data);
      }),
    ),
  );
  router.delete(
    "/",
    result(async (req, res) =>
      signed(req, res, async (auth) => {
        const password = req.body?.password;
        if (typeof password !== "string" || password.length > 128)
          throw new CandidateError("Confirmez votre mot de passe.");
        const fresh = await client.call("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email: auth.user.email, password },
        });
        if (fresh.user?.id !== auth.user.id)
          throw new CandidateError("Connexion requise.", 403);
        await client.rpc(
          "of_delete_my_account",
          {},
          { token: fresh.access_token },
        );
        clearCookies(res);
        res.json({ ok: true });
      }),
    ),
  );
  router.post(
    "/view",
    result(async (req, res) => {
      await requireReady();
      limited(viewLimit, req.ip);
      const auth = await session(req, res, false);
      await client.rpc(
        "of_record_view",
        { p_page: req.body?.page || "search" },
        auth ? { token: auth.token } : {},
      );
      res.json({ ok: true });
    }),
  );
  router.post(
    "/unsubscribe",
    result(async (req, res) => {
      await requireReady();
      const id = uuid(req.body?.id);
      if (!client.validUnsubscribe(id, req.body?.token))
        throw new CandidateError("Lien de désabonnement invalide.", 403);
      await client.rest("of_alerts?user_id=eq." + id, {
        method: "PATCH",
        admin: true,
        body: { email_enabled: false },
      });
      res.json({ ok: true });
    }),
  );
  app.use("/api/account", router);
  app.get(
    "/api/admin/candidates",
    admin,
    result(async (_req, res) => {
      const config = await status();
      res.json({
        configuration: config,
        stats:
          config.enabled && client.hasServiceKey
            ? await client.rpc("of_admin_stats", {}, { admin: true })
            : null,
      });
    }),
  );

  async function processAlerts() {
    if (working) return working;
    working = (async () => {
      if (!(await status()).enabled || !client.hasServiceKey)
        return { matched: 0, emails: 0 };
      const matched = await matchAlerts({ admin: true });
      let emails = 0;
      if (!mailer.ready) return { matched, emails };
      const alerts = await client.all(
        "of_alerts?select=*&email_enabled=eq.true",
        { admin: true },
      );
      for (const userId of [...new Set(alerts.map((a) => a.user_id))]) {
        const userData = await client.call(
          "/auth/v1/admin/users/" + uuid(userId),
          { admin: true },
        );
        const user = userData.user || userData;
        if (!user.email_confirmed_at || !user.email) continue;
        const profile = (
          await client.rest(
            "of_profiles?id=eq." + userId + "&select=last_digest_at",
            { admin: true },
          )
        )[0];
        const ids = alerts.filter((a) => a.user_id === userId).map((a) => a.id);
        const notifications = await client.rest(
          "of_notifications?select=*&user_id=eq." +
            userId +
            "&alert_id=in.(" +
            ids.join(",") +
            ")" +
            (profile?.last_digest_at
              ? "&created_at=gt." + encodeURIComponent(profile.last_digest_at)
              : "") +
            "&order=created_at.desc&limit=20",
          { admin: true },
        );
        if (
          !notifications.length ||
          !(await client.rpc(
            "of_claim_digest",
            { p_user: userId },
            { admin: true },
          ))
        )
          continue;
        const at = new Date().toISOString(),
          jobId = userId + ":" + at.slice(0, 10);
        try {
          const live = [];
          for (const n of notifications)
            if (await store.getPublic(n.offer_id)) live.push(n);
          const unique = [
            ...new Map(live.map((n) => [n.offer_id, n])).values(),
          ].slice(0, 10);
          if (!unique.length) {
            await client.rest(
              "of_mail_jobs?id=eq." + encodeURIComponent(jobId),
              { method: "PATCH", admin: true, body: { status: "failed" } },
            );
            continue;
          }
          await mailer.send({
            to: user.email,
            subject:
              "De nouvelles offres pour vos recherches — Offres Fraîches",
            text:
              "De nouvelles offres correspondent à vos recherches. Voici quelques pistes :\n\n" +
              unique
                .map((n) => n.snapshot.title + " — " + n.snapshot.company.name)
                .join("\n") +
              "\n\nConsultez vos alertes : " +
              client.siteUrl +
              "/compte\nSe désabonner des e-mails : " +
              client.siteUrl +
              "/compte#unsubscribe=" +
              userId +
              "." +
              client.unsubscribeToken(userId),
          });
          await client.rest("of_mail_jobs?id=eq." + encodeURIComponent(jobId), {
            method: "PATCH",
            admin: true,
            body: { status: "sent", sent_at: at },
          });
          await client.rest("of_profiles?id=eq." + userId, {
            method: "PATCH",
            admin: true,
            body: { last_digest_at: at },
          });
          emails++;
        } catch {
          await client.rest("of_mail_jobs?id=eq." + encodeURIComponent(jobId), {
            method: "PATCH",
            admin: true,
            body: { status: "failed" },
          });
        }
      }
      return { matched, emails };
    })().finally(() => {
      working = null;
    });
    return working;
  }
  const service = {
    status,
    processAlerts,
    start() {
      if (enabled && !workerTimer) {
        workerTimer = setInterval(
          () =>
            processAlerts().catch(() =>
              console.error(
                "[Comptes] Actualisation des alertes indisponible.",
              ),
            ),
          15 * 60000,
        );
        workerTimer.unref();
        processAlerts().catch(() =>
          console.error("[Comptes] Actualisation des alertes indisponible."),
        );
      }
    },
    async stop() {
      if (workerTimer) clearInterval(workerTimer);
      workerTimer = null;
      await working?.catch(() => {});
    },
  };
  return service;
}
