import { isNonProductionOffer } from "../shared/production-policy.js";
import { isBlockedSource } from "../shared/source-policy.js";
import { isTrainingEmployer } from "../shared/employer-policy.js";
import { hasRecentPublication } from "../shared/freshness.js";
import { domains, contracts } from "../shared/catalog.js";
import { regions } from "../src/domain.js";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { companyTypes, companySizes, companyTags } from "../shared/company.js";
import { plainText, extractKeywords } from "./enrichment.js";
export class ValidationError extends Error {}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      isIP(u.hostname) ||
      !u.hostname.includes(".") ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
const text = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
function required(value, label, max = 200) {
  if (
    typeof value !== "string" ||
    value.trim().length < 2 ||
    value.length > max
  )
    throw new ValidationError(`${label} : valeur manquante ou trop longue.`);
  return value.trim();
}
function link(value, label) {
  const u = safeUrl(value);
  if (!u)
    throw new ValidationError(
      `${label} : utilisez une URL HTTPS publique valide.`,
    );
  return u;
}
function isoDate(value, label, { future = false, optional = false } = {}) {
  if (!value && optional) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value || "") ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new ValidationError(`${label} : date invalide.`);
  if (!future && Date.parse(value) > Date.now())
    throw new ValidationError(`${label} ne peut pas être dans le futur.`);
  return value;
}
export function normalizeSubmission(
  body,
  {
    now = new Date().toISOString(),
    allowOlderActiveSource = false,
    allowMissingWebsite = false,
    allowFranceTravailSource = false,
    companyIdentity = null,
  } = {},
) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ValidationError("Formulaire invalide.");
  if (isBlockedSource(body))
    throw new ValidationError(
      "Les annonces provenant de Meteojob sont exclues.",
    );
  if (isNonProductionOffer(body))
    throw new ValidationError(
      "Les annonces de recette ou de démonstration ne sont pas publiables.",
    );
  if (body.websiteTrap) throw new ValidationError("Dépôt refusé.");
  if (body.consent !== true)
    throw new ValidationError("Confirmez votre autorisation de publication.");
  if (!domains.includes(body.domain) || !contracts.includes(body.contract))
    throw new ValidationError(
      "Choisissez un domaine et un contrat de stage ou d’alternance.",
    );
  if (!Object.hasOwn(regions, body.region))
    throw new ValidationError("Choisissez une région française.");
  const website = allowMissingWebsite
      ? safeUrl(body.companyWebsite) || null
      : link(body.companyWebsite, "Site entreprise"),
    sourceUrl = link(body.sourceUrl, "Annonce originale");
  const sourceHost = new URL(sourceUrl).hostname;
  if (
    /(^|\.)(google\.[a-z.]+|bing\.com)$/.test(sourceHost) ||
    (!allowFranceTravailSource &&
      /(^|\.)francetravail\.(fr|io)$/.test(sourceHost))
  ) {
    throw new ValidationError(
      "Utilisez l’annonce sur le site de l’entreprise ou son outil officiel de recrutement, pas un moteur de recherche ni France Travail.",
    );
  }
  const companyName = required(body.companyName, "Entreprise", 120);
  if (isTrainingEmployer(companyName, body.sector || ""))
    throw new ValidationError(
      "Les annonces d’écoles et organismes de formation ne sont pas acceptées.",
    );
  const contact = text(body.publicEmail, 180),
    publicContacts = [];
  if (contact) {
    const [role, host, extra] = contact.toLowerCase().split("@");
    const companyHost = new URL(website).hostname.replace(/^www\./, "");
    if (
      extra ||
      !/^(recrutement|recruitment|careers|jobs|rh|talents?|stages?|alternance|recrute|emploi|recruiting|hr|contact)([-+_][a-z0-9]+)?$/.test(
        role,
      ) ||
      !(host === companyHost || host?.endsWith("." + companyHost))
    )
      throw new ValidationError(
        "Utilisez uniquement une adresse générique de recrutement sur le domaine de l’entreprise, jamais une adresse personnelle.",
      );
    const provenance = link(body.contactProvenance, "Page publique du contact");
    const provenanceHost = new URL(provenance).hostname.replace(/^www\./, "");
    if (
      provenanceHost !== companyHost &&
      !provenanceHost.endsWith("." + companyHost)
    )
      throw new ValidationError(
        "La provenance du contact doit être une page de l’entreprise.",
      );
    if (body.contactConsent !== true)
      throw new ValidationError(
        "Confirmez que ce contact générique est public et autorisé.",
      );
    publicContacts.push({
      type: "email",
      value: contact.toLowerCase(),
      provenance,
      role: ["RH", "Tutorat", "Recrutement"].includes(body.contactRole)
        ? body.contactRole
        : null,
    });
  }
  const publishedAt = isoDate(body.publishedAt, "Publication", {
    optional: true,
  });
  if (
    !allowOlderActiveSource &&
    publishedAt &&
    Date.now() - Date.parse(publishedAt) > 30 * 86400000
  )
    throw new ValidationError(
      "L’annonce source doit dater de moins de 30 jours pour un nouveau dépôt.",
    );
  const expiresAt = isoDate(body.expiresAt, "Fin de validité", {
    future: true,
  });
  if (
    Date.parse(expiresAt) + 86400000 <= Date.now() ||
    Date.parse(expiresAt) > Date.now() + 90 * 86400000
  )
    throw new ValidationError(
      "La fin de validité doit être comprise entre aujourd’hui et 90 jours.",
    );
  const list = (value, max = 20) =>
    [
      ...new Set(
        (Array.isArray(value)
          ? value
          : typeof value === "string"
            ? value.split(/[,;\n]/)
            : []
        )
          .map((v) => plainText(v, 120))
          .filter(Boolean),
      ),
    ].slice(0, max);
  const tags = list(body.companyTags);
  if (tags.some((tag) => !companyTags.includes(tag)))
    throw new ValidationError("Tag entreprise non reconnu.");
  if (body.companyType && !companyTypes.includes(body.companyType))
    throw new ValidationError("Type d’entreprise non reconnu.");
  if (body.companySize && !companySizes.includes(body.companySize))
    throw new ValidationError("Taille d’entreprise non reconnue.");
  const hasProfile =
    [
      body.companyType,
      body.companySize,
      body.companyLocations,
      body.companyStack,
      body.companyRhythm,
      body.companyCertifications,
    ].some((v) => v && v.length) || tags.length;
  if (hasProfile && !body.profileSourceUrl)
    throw new ValidationError(
      "Indiquez la page source des informations enrichies de l’entreprise.",
    );
  if (body.companyLogoUrl && body.logoConsent !== true)
    throw new ValidationError("Confirmez votre droit d’utiliser le logo.");
  const description = plainText(
    required(body.description, "Description", 12000),
  );
  if (description.length < 2)
    throw new ValidationError("La description nettoyée est vide.");
  return {
    id: randomUUID(),
    title: required(body.title, "Intitulé", 180),
    company: {
      id: website
        ? new URL(website).hostname.replace(/^www\./, "")
        : companyIdentity,
      name: companyName,
      website,
      sector: text(body.sector) || null,
      description: plainText(text(body.companyDescription, 2000), 2000) || null,
      type: body.companyType || null,
      size: body.companySize || null,
      locations: list(body.companyLocations),
      stack: list(body.companyStack),
      rhythm: text(body.companyRhythm, 200) || null,
      certifications: list(body.companyCertifications),
      tags,
      logoUrl: body.companyLogoUrl
        ? link(body.companyLogoUrl, "Logo autorisé")
        : null,
      profileSourceUrl: body.profileSourceUrl
        ? link(body.profileSourceUrl, "Provenance entreprise")
        : null,
      location: required(body.city, "Ville", 120),
    },
    contract: body.contract,
    location: {
      label: required(body.city, "Ville", 120),
      region: body.region,
      commune: null,
    },
    domain: body.domain,
    education: body.education
      ? [required(body.education, "Niveau de formation", 100)]
      : [],
    description,
    extractedKeywords: extractKeywords(description),
    missions: plainText(text(body.missions, 4000), 4000)
      .split("\n")
      .filter(Boolean),
    skills: plainText(text(body.skills, 2000), 2000)
      .split("\n")
      .filter(Boolean),
    duration: text(body.duration, 120) || null,
    startsAt: body.startsAt
      ? isoDate(body.startsAt, "Début", { future: true })
      : null,
    sourceUrl,
    applicationUrl: link(body.applicationUrl || body.sourceUrl, "Candidature"),
    source:
      body.origin === "editorial"
        ? "Site officiel de l’entreprise"
        : "Dépôt entreprise — identité à valider",
    origin: body.origin === "editorial" ? "editorial" : "employer",
    publishedAt,
    firstRetrievedAt: now,
    lastVerifiedAt: null,
    status: "to_verify",
    moderationStatus: "pending",
    expiresAt,
    publicContacts,
    sponsored: false,
    submittedAt: now,
  };
}
const clean = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
export function duplicateOf(a, b) {
  const canon = (value) => {
    const u = new URL(value);
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (key.startsWith("utm_")) u.searchParams.delete(key);
    return u.href.replace(/\/$/, "");
  };
  return (
    a.id === b.id ||
    canon(a.sourceUrl) === canon(b.sourceUrl) ||
    [a.title, a.company.name, a.location.label].map(clean).join("|") ===
      [b.title, b.company.name, b.location.label].map(clean).join("|")
  );
}
export function deduplicate(offers) {
  return offers.reduce(
    (all, o) => (all.some((x) => duplicateOf(x, o)) ? all : [...all, o]),
    [],
  );
}
export function nonComplianceReasons(offer, now = Date.now()) {
  const reasons = [];
  if (offer.sourceClosedAt) reasons.push("source_closed");
  if (isNonProductionOffer(offer)) reasons.push("non_production_source");
  if (isBlockedSource(offer)) reasons.push("blocked_source_meteojob");
  if (!hasRecentPublication(offer, now))
    reasons.push("publication_outside_45_days");
  if (!domains.includes(offer.domain)) reasons.push("non_technical_domain");
  if (!contracts.includes(offer.contract)) reasons.push("ineligible_contract");
  if (
    !Object.hasOwn(regions, offer.location?.region || "") ||
    !offer.location?.label?.trim()
  )
    reasons.push("location_not_established_in_france");
  if (!offer.company?.name?.trim()) reasons.push("missing_employer");
  if (
    isTrainingEmployer(
      offer.company?.name,
      offer.company?.sector,
      offer.company?.nafCode,
    )
  )
    reasons.push("training_employer");
  const source = safeUrl(offer.sourceUrl);
  if (
    !source ||
    /(^|\.)(google\.[a-z.]+|bing\.com)$/.test(new URL(source).hostname)
  )
    reasons.push("missing_original_source");
  if (
    !Number.isFinite(Date.parse(offer.expiresAt)) ||
    Date.parse(offer.expiresAt) + 86400000 <= now
  )
    reasons.push("local_expiration");
  if (
    offer.sourceExpiresAt &&
    (!Number.isFinite(Date.parse(offer.sourceExpiresAt)) ||
      Date.parse(offer.sourceExpiresAt) <= now)
  )
    reasons.push("source_expiration");
  if (
    offer.sourceId === "la-bonne-alternance" &&
    offer.sourceStatus &&
    offer.sourceStatus !== "Active"
  )
    reasons.push("source_inactive");
  return reasons;
}
export function publicOffer(offer, now = Date.now()) {
  if (
    nonComplianceReasons(offer, now).length ||
    offer.moderationStatus !== "approved" ||
    ["expired", "withdrawn"].includes(offer.status)
  )
    return null;
  // A dated manual review expires after seven days unless an editor rechecks it.
  const stillVerified =
    offer.lastVerifiedAt &&
    now - Date.parse(offer.lastVerifiedAt) >= 0 &&
    now - Date.parse(offer.lastVerifiedAt) <= 7 * 86400000;
  const { moderationStatus, reviewNote, ...safe } = offer;
  return { ...safe, status: stillVerified ? "active" : "to_verify" };
}
