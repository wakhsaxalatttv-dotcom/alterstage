import { isTrainingEmployer } from "../../shared/employer-policy.js";
import { isRecentPublication } from "../../shared/freshness.js";
import { createHash } from "node:crypto";
import { regions } from "../../src/domain.js";
import { plainText } from "../enrichment.js";
export const romeDomains = {
  H1503: "Chimie, procédés & matériaux",
  H2301: "Chimie, procédés & matériaux",
  M1801: "Systèmes, réseaux & cloud",
  M1802: "Systèmes, réseaux & cloud",
  M1803: "Autres métiers informatiques",
  M1804: "Développement logiciel & web",
  M1805: "Développement logiciel & web",
  M1806: "Systèmes, réseaux & cloud",
  M1807: "Systèmes, réseaux & cloud",
  M1810: "Systèmes, réseaux & cloud",
  I1401: "Support & maintenance informatique",
  I1307: "Télécommunications",
  F1605: "Télécommunications",
  I1302: "Automatismes & robotique",
  I1304: "Maintenance industrielle",
  I1309: "Électricité & électrotechnique",
  I1310: "Maintenance industrielle",
  H1202: "Conception, méthodes & bureau d’études",
  H1206: "Conception, méthodes & bureau d’études",
  H1208: "Automatismes & robotique",
  H1209: "Électronique & instrumentation",
  H1210: "Conception, méthodes & bureau d’études",
  H1402: "Conception, méthodes & bureau d’études",
  H1504: "Qualité, sécurité & métrologie",
  H1506: "Qualité, sécurité & métrologie",
};
export const lbaSource = {
  id: "la-bonne-alternance",
  name: "La Bonne Alternance",
  kind: "lba",
  url:
    "https://api.apprentissage.beta.gouv.fr/api/job/v1/search?" +
    new URLSearchParams({
      romes: Object.keys(romeDomains).join(","),
      partners_to_exclude: "France Travail",
    }),
  allowedHosts: ["api.apprentissage.beta.gouv.fr"],
  tokenEnv: "LBA_API_KEY",
  enabled: true,
  authorized: true,
  licenseUrl:
    "https://api.apprentissage.beta.gouv.fr/fr/explorer/recherche-offre",
  authorizationRef:
    "Diffusion gratuite non lucrative selon les conditions de l’API ; publication limitée à 45 jours sur demande du responsable du projet.",
  includeOlderActive: true,
  publishUnverified: true,
};
export function parseLba(body, now = Date.now()) {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  if (!Array.isArray(data.jobs)) throw new Error("Réponse LBA invalide");
  const excluded = {
      old: 0,
      sandbox: 0,
      school: 0,
      inactive: 0,
      franceTravail: 0,
      missing: 0,
      outOfScope: 0,
    },
    records = [];
  for (const j of data.jobs) {
    const label = j.identifier?.partner_label || "";
    if (
      /\b(sandbox|recette|demo|démonstration|simulation|test)\b/i.test(label)
    ) {
      excluded.sandbox++;
      continue;
    }
    if (
      /france\s*travail|p[oô]le\s*emploi/i.test(label) ||
      /francetravail\.(fr|io)/i.test(j.apply?.url || "")
    ) {
      excluded.franceTravail++;
      continue;
    }
    if (
      j.is_delegated !== false ||
      isTrainingEmployer(
        j.workplace?.name || j.workplace?.legal_name,
        j.workplace?.domain?.naf?.label,
        j.workplace?.domain?.naf?.code,
      ) ||
      /RH Alternance|Bloom Alternance|Bretagne Alternance/i.test(label)
    ) {
      excluded.school++;
      continue;
    }
    const expiry = Date.parse(j.offer?.publication?.expiration),
      created = Date.parse(j.offer?.publication?.creation);
    if (
      j.offer?.status !== "Active" ||
      !Number.isFinite(expiry) ||
      expiry <= now
    ) {
      excluded.inactive++;
      continue;
    }
    if (!isRecentPublication(j.offer?.publication?.creation, now)) {
      excluded.old++;
      continue;
    }
    const domain = j.offer?.rome_codes
      ?.map((c) => romeDomains[c])
      .find(Boolean);
    if (!domain) {
      excluded.outOfScope++;
      continue;
    }
    const types =
      j.contract?.type
        ?.map((t) =>
          t === "Apprentissage"
            ? "Apprentissage"
            : t === "Professionnalisation"
              ? "Contrat de professionnalisation"
              : null,
        )
        .filter(Boolean) || [];
    const address = j.workplace?.location?.address || "";
    const location = address.match(
      /\b(\d{5})\s+([^,\n]+?)(?:,?\s+France)?\s*$/iu,
    );
    const dep = location?.[1].startsWith("97")
      ? location[1].slice(0, 3)
      : location?.[1].slice(0, 2);
    const region =
      dep === "20"
        ? "Corse"
        : Object.keys(regions).find((r) => regions[r].split(" ").includes(dep));
    const name = j.workplace?.name || j.workplace?.legal_name;
    if (
      !name ||
      !location ||
      !region ||
      !types.length ||
      !Number.isFinite(created) ||
      created > now ||
      !j.apply?.url
    ) {
      excluded.missing++;
      continue;
    }
    const identity = j.workplace?.siret
      ? `siret:${j.workplace.siret}`
      : "lba-company:" +
        createHash("sha256")
          .update(name + "|" + location[1])
          .digest("hex")
          .slice(0, 20);
    records.push({
      externalId: j.identifier.id || j.identifier.partner_job_id,
      title: plainText(j.offer.title, 180),
      companyName: name,
      companyWebsite: j.workplace.website,
      companyIdentity: identity,
      sector: j.workplace.domain?.naf?.label || "",
      companyDescription: plainText(j.workplace.description || "", 2000),
      sourceUrl: j.apply.url,
      applicationUrl: j.apply.url,
      city: location[2].trim(),
      region,
      domain,
      contract: types[0],
      acceptedContracts: [...new Set(types)],
      description: j.offer.description,
      education: j.offer.target_diploma?.label || "",
      skills: (j.offer.desired_skills || []).join("\n"),
      duration: Number.isInteger(j.contract.duration)
        ? `${j.contract.duration} mois`
        : null,
      startsAt: j.contract.start?.slice(0, 10) || "",
      publishedAt: j.offer.publication.creation,
      expiresAt: new Date(Math.min(expiry, now + 89 * 86400000))
        .toISOString()
        .slice(0, 10),
      sourceExpiresAt: j.offer.publication.expiration,
      sourcePartner: label,
      sourceStatus: "Active",
    });
  }
  records.exclusions = {
    ...excluded,
    recruiters: data.recruiters?.length || 0,
  };
  return records;
}
