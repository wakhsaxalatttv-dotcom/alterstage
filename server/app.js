import { administrationConfiguration } from "./admin-config.js";
import { Reports } from "./reports.js";
import express from "express";
import compression from "compression";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { OfferStore } from "./store.js";
import { normalizeSubmission, ValidationError } from "./domain.js";
import { IngestionPipeline } from "./ingestion/pipeline.js";
export function createApp({
  folder = process.env.DATA_DIR || path.resolve(".local"),
  adminToken = process.env.ADMIN_TOKEN || "",
  pipelineOptions = {},
} = {}) {
  const app = express(),
    store = new OfferStore(folder),
    limits = new Map();
  app.locals.store = store;
  const adminConfiguration = administrationConfiguration(adminToken);
  app.locals.adminConfiguration = adminConfiguration;
  const reports = new Reports(store),
    reportLimits = new Map();
  app.locals.reports = reports;
  app.locals.pipeline = new IngestionPipeline(store, pipelineOptions);
  app.disable("x-powered-by");
  if (process.env.RENDER === "true") app.set("trust proxy", 1);
  app.use(compression({ threshold: 1024 }));
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "40kb" }));
  const admin = (req, res, next) => {
    if (!adminConfiguration.configured)
      return res.status(503).json({
        message: "L’espace privé est temporairement indisponible.",
      });
    const token = Buffer.from(
      req.get("Authorization")?.replace(/^Bearer /, "") || "",
    );
    const expected = Buffer.from(adminToken);
    if (token.length !== expected.length || !timingSafeEqual(token, expected))
      return res
        .status(401)
        .json({ message: "Accès réservé à la modération." });
    next();
  };
  app.get("/api/health", (_req, res) => {
    store.db.prepare("SELECT 1").get();
    res.json({ status: "ok", storage: "sqlite" });
  });
  const queryParams = (req) =>
    Object.fromEntries(
      Object.entries(req.query)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k, v.slice(0, 200)]),
    );
  app.get("/api/offers", async (req, res) => {
    const result = await store.query(queryParams(req));
    res.json({
      ...result,
      status: "connected",
      message: result.total
        ? "Annonces d’entreprises et offres actives selon une API autorisée. Les offres anciennes sont signalées ; la réception par API ne vérifie pas le recrutement."
        : "Aucune annonce validée ne correspond. Les pistes entreprises ne sont pas des offres confirmées.",
      sources: [
        {
          id: "direct",
          name: "Entreprises et flux autorisés",
          status: "active",
        },
      ],
    });
  });
  app.get("/api/offers/:id", async (req, res) => {
    const offer = await store.getPublic(req.params.id);
    if (!offer)
      return res.status(404).json({
        message: "Cette offre n’est plus disponible dans le catalogue public.",
      });
    res.json({ offer });
  });
  app.get("/api/companies", async (req, res) =>
    res.json(await store.companies(queryParams(req))),
  );
  app.get("/api/companies/:id", async (req, res) => {
    const company = await store.company(req.params.id);
    if (!company)
      return res.status(404).json({ message: "Entreprise introuvable." });
    const linked = await store.query({
      ...queryParams(req),
      companyId: company.id,
    });
    res.json({ company, ...linked });
  });
  app.post("/api/submissions", async (req, res) => {
    if (!adminConfiguration.configured)
      return res.status(503).json({
        message:
          "Les dépôts sont temporairement indisponibles. Réessayez plus tard.",
      });
    const now = Date.now();
    for (const [key, val] of limits) if (val.until < now) limits.delete(key);
    const key = req.ip,
      entry = limits.get(key) || { count: 0, until: now + 3600000 };
    if (entry.count >= 5)
      return res.status(429).json({
        message:
          "Limite de cinq dépôts par heure atteinte. Réessayez plus tard.",
      });
    entry.count++;
    limits.set(key, entry);
    const offer = normalizeSubmission({ ...req.body, origin: "employer" });
    res.status(201).json(await store.submit(offer));
  });
  app.get("/api/references", (_req, res) =>
    res.json({ offers: reports.references() }),
  );
  app.post("/api/reports", async (req, res) => {
    if (!adminConfiguration.configured)
      return res.status(503).json({
        message:
          "L’envoi de signalements est temporairement indisponible. Réessayez plus tard.",
      });
    const now = Date.now();
    for (const [key, entry] of reportLimits)
      if (entry.until < now) reportLimits.delete(key);
    const key = req.ip,
      entry = reportLimits.get(key) || { count: 0, until: now + 3600000 };
    if (entry.count >= 10)
      return res.status(429).json({
        message:
          "Limite de dix signalements par heure atteinte. Réessayez plus tard.",
      });
    entry.count++;
    reportLimits.set(key, entry);
    res.status(201).json(await reports.create(req.body || {}));
  });
  app.get("/api/admin/reports", admin, (req, res) =>
    res.json(reports.list(queryParams(req))),
  );
  app.post("/api/admin/reports/:id/review", admin, (req, res) =>
    res.json(reports.review(req.params.id, req.body || {})),
  );
  app.get("/api/admin/submissions", admin, async (req, res) =>
    res.json(await store.adminQuery(queryParams(req))),
  );
  app.post("/api/admin/import", admin, async (req, res) =>
    res
      .status(201)
      .json(
        await store.submit(
          normalizeSubmission({ ...req.body, origin: "editorial" }),
        ),
      ),
  );
  app.post("/api/admin/submissions/:id/review", admin, async (req, res) =>
    res.json(await store.review(req.params.id, req.body || {})),
  );
  app.get("/api/admin/sources", admin, async (_req, res) =>
    res.json(await app.locals.pipeline.status()),
  );
  app.post("/api/admin/ingest", admin, (_req, res) => {
    app.locals.pipeline
      .run()
      .catch(() =>
        console.error(
          "Collecte interrompue : vérifier la configuration serveur.",
        ),
      );
    res.status(202).json({
      running: true,
      message:
        "Collecte lancée en arrière-plan. Les résultats apparaîtront dans le journal ; aucune annonce ne sera publiée sans revue.",
    });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ message: "Route API introuvable." }),
  );
  app.use(
    "/assets",
    express.static(path.resolve("dist/assets"), {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use("/administration", (_req, res, next) => {
    res.set({
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "no-store",
    });
    next();
  });
  app.use(express.static(path.resolve("dist"), { maxAge: 0 }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof ValidationError)
      return res.status(400).json({ message: error.message });
    if (error.type === "entity.too.large")
      return res.status(413).json({ message: "Formulaire trop volumineux." });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ message: "Formulaire invalide." });
    console.error("Erreur application :", error.code || error.name);
    res.status(500).json({
      message:
        "Le service est indisponible. Votre demande n’a pas été confirmée ; réessayez plus tard.",
    });
  });
  return app;
}
