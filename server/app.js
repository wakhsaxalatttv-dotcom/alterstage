import express from "express";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { OfferStore } from "./store.js";
import { normalizeSubmission, ValidationError } from "./domain.js";
export function createApp({
  folder = process.env.DATA_DIR || path.resolve(".local"),
  adminToken = process.env.ADMIN_TOKEN || "",
} = {}) {
  const app = express(),
    store = new OfferStore(folder),
    limits = new Map();
  app.disable("x-powered-by");
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
    if (adminToken.length < 32)
      return res
        .status(503)
        .json({
          message:
            "Modération non configurée : définissez ADMIN_TOKEN (32 caractères minimum) sur le serveur.",
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
  app.get("/api/offers", async (_req, res) => {
    const offers = await store.publicList();
    res.json({
      status: "connected",
      offers,
      message: offers.length
        ? "Annonces publiées après contrôle manuel. Chaque fiche conserve sa source et sa date de vérification."
        : "Aucune annonce validée pour le moment. Consultez les sites d’entreprises ou proposez une annonce à la modération.",
      sources: [
        {
          id: "direct",
          name: "Sites et dépôts directs des entreprises",
          status: "active",
        },
      ],
    });
  });
  app.post("/api/submissions", async (req, res) => {
    if (adminToken.length < 32)
      return res
        .status(503)
        .json({
          message:
            "Le dépôt est temporairement fermé : la modération doit être configurée par le responsable du site.",
        });
    const now = Date.now();
    for (const [key, val] of limits) if (val.until < now) limits.delete(key);
    const key = req.ip,
      entry = limits.get(key) || { count: 0, until: now + 3600000 };
    if (entry.count >= 5)
      return res
        .status(429)
        .json({
          message:
            "Limite de cinq dépôts par heure atteinte. Réessayez plus tard.",
        });
    entry.count++;
    limits.set(key, entry);
    const offer = normalizeSubmission({ ...req.body, origin: "employer" });
    res.status(201).json(await store.submit(offer));
  });
  app.get("/api/admin/submissions", admin, async (_req, res) =>
    res.json({ offers: await store.read() }),
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
  app.use("/api", (_req, res) =>
    res.status(404).json({ message: "Route API introuvable." }),
  );
  app.use(express.static(path.resolve("dist")));
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
    res
      .status(500)
      .json({
        message:
          "Le service est indisponible. Votre demande n’a pas été confirmée ; réessayez plus tard.",
      });
  });
  return app;
}
