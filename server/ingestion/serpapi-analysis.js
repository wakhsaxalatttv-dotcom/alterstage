import { createHash } from "node:crypto";
import { normalizeSubmission, nonComplianceReasons } from "../domain.js";
import { searchText } from "../enrichment.js";
import {
  hasRecentPublication,
  publicationIndex,
} from "../../shared/freshness.js";
const domainRules = [
  ["Cybersécurité", /cyber|securite informatique|pentest|soc analyst/],
  [
    "Chimie, procédés & matériaux",
    /chimie|chimiste|materiaux|polymer|formulation|genie des procedes/,
  ],
  [
    "Informatique embarquée & IoT",
    /informatique embarque|systemes? embarque|embedded|\biot\b|firmware/,
  ],
  [
    "Data, IA & machine learning",
    /\bdata\b|machine learning|intelligence artificielle|data scientist/,
  ],
  [
    "Qualité logicielle & tests",
    /qualite logicielle|test logiciel|testeur logiciel|\bqa\b/,
  ],
  [
    "Développement logiciel & web",
    /developpeu|developpement (?:web|logiciel)|software|full.?stack|front.?end|back.?end/,
  ],
  [
    "Support & maintenance informatique",
    /support informatique|maintenance informatique|helpdesk|technicien informatique/,
  ],
  [
    "Télécommunications",
    /telecom|telecommunication|fibre optique|reseau mobile/,
  ],
  [
    "Systèmes, réseaux & cloud",
    /\bcloud\b|administrat.*(?:system|reseau)|\bdevops\b|systemes? et reseaux|reseau informatique|\blinux\b/,
  ],
  ["Automatismes & robotique", /automatis|robotique|roboticien/],
  [
    "Électronique & instrumentation",
    /electronique|instrumentation|microelectronique/,
  ],
  ["Électricité & électrotechnique", /electric|electrotechni/],
  [
    "Maintenance industrielle",
    /maintenance industrielle|technicien de maintenance|maintenance des equipements/,
  ],
  ["Mécanique & productique", /mecanique|productique|usinage|chaudronnerie/],
  [
    "Énergie & environnement",
    /energetique|energie|environnement|decarbon|thermique/,
  ],
  [
    "Bâtiment, génie civil & travaux publics",
    /genie civil|travaux publics|batiment|construction/,
  ],
  ["Aéronautique, spatial & naval", /aeronautique|aerospatial|spatial|naval/],
  [
    "Conception, méthodes & bureau d’études",
    /bureau d.etudes|ingenieur methodes|technicien methodes|conception industrielle/,
  ],
  [
    "Qualité, sécurité & métrologie",
    /metrologie|qualite industrielle|qualite securite|\bqhse\b|\bhse\b/,
  ],
  ["Autres métiers informatiques", /informatiqu/],
  ["Autres métiers techniques", /technicien industriel|ingenieur industriel/],
];
export function analyzeSerpCandidate(candidate) {
  const title = searchText(candidate.title),
    description = searchText(candidate.description);
  const reasons = [];
  if (!hasRecentPublication({ ...candidate, sourceId: "serpapi-google-jobs" }))
    reasons.push("publication_missing_or_outside_45_days");
  if (
    /commercial|marketing|recruteur|ressources humaines|comptable|business develop/.test(
      title,
    )
  )
    reasons.push("non_technical_role");
  const domain =
    domainRules.find(([, rule]) => rule.test(title))?.[0] ||
    domainRules
      .slice(0, -2)
      .find(
        ([, rule]) =>
          rule.test(description) &&
          /ingenieur|technicien|develop|analyst/.test(title),
      )?.[0];
  if (!domain) reasons.push("technical_domain_not_established");
  const contracts = [];
  const contractDescription = description
    .split(/[.!?;]+/)
    .filter(
      (clause) =>
        !/\b(?:pas|aucun|aucune|sans|hors|ni)\b.{0,50}\b(?:stage|apprentissage|alternance|professionnalisation)\b/.test(
          clause,
        ),
    )
    .join(". ");
  const sourceContract = searchText(candidate.contractText || candidate.title);
  if (
    /\bstage\b|\bstagiaire\b|\bintern(?:ship)?\b/.test(sourceContract) ||
    /ce stage|offre de stage|propos(?:ons|e) un stage|(?:recherchons|recrutons) un stagiaire|duree du stage|stage conventionne|(?:type de contrat|contrat)\s*:\s*stage/.test(
      contractDescription,
    )
  )
    contracts.push("Stage");
  if (
    /apprenti|apprentissage/.test(sourceContract) ||
    /contrat d.apprentissage/.test(contractDescription)
  )
    contracts.push("Apprentissage");
  if (
    /contrat de professionnalisation/.test(
      sourceContract + " " + contractDescription,
    )
  )
    contracts.push("Contrat de professionnalisation");
  if (
    !contracts.length &&
    (/\balternan(?:ce|t|te|ts|tes)\b/.test(sourceContract) ||
      /\b(?:poste|offre|contrat|emploi|mission)\b[^.!?;]{0,90}\b(?:en alternance|d.alternance)\b/.test(
        contractDescription,
      ) ||
      /\b(?:type de contrat|contrat)\s*:\s*alternance\b/.test(
        contractDescription,
      ) ||
      /\b(?:recrutons|recherchons|proposons|offrons)\b[^.!?;]{0,90}\b(?:alternant(?:e)?|en alternance)\b/.test(
        contractDescription,
      ))
  )
    contracts.push("Alternance — type non précisé");
  if (!contracts.length) reasons.push("contract_not_established");
  return { domain: domain || null, contracts, reasons };
}
export function automaticSerpOffer(
  candidate,
  analysis,
  location,
  now = new Date().toISOString(),
) {
  if (analysis.reasons.length || !location) return null;
  const expiresAt = new Date(
    Math.min(
      Date.parse(
        publicationIndex({ ...candidate, sourceId: "serpapi-google-jobs" }),
      ) +
        46 * 86400000,
      Date.parse(candidate.lastRetrievedAt || now) + 7 * 86400000,
    ),
  )
    .toISOString()
    .slice(0, 10);
  const offer = normalizeSubmission(
    {
      title: candidate.title,
      companyName: candidate.companyName,
      companyWebsite: "",
      city: location.city,
      region: location.region,
      domain: analysis.domain,
      contract: analysis.contracts[0],
      description: candidate.description,
      sourceUrl: candidate.sourceUrl,
      applicationUrl: candidate.applicationUrl,
      publishedAt: candidate.publishedAt,
      expiresAt,
      consent: true,
      origin: "editorial",
    },
    {
      allowMissingWebsite: true,
      allowOlderActiveSource: true,
      companyIdentity:
        "serp-company:" +
        createHash("sha256")
          .update(searchText(candidate.companyName))
          .digest("hex")
          .slice(0, 20),
      now,
    },
  );
  Object.assign(offer, {
    origin: "feed",
    sourceId: "serpapi-google-jobs",
    sourceName: "Google Jobs via SerpApi",
    source: "Google Jobs via SerpApi",
    sourcePartner: candidate.via || null,
    sourcePolicyApproved: true,
    externalId: candidate.id,
    sourcePublishedAt: candidate.sourcePublishedAt || candidate.publishedAt,
    publicationEvidence: candidate.publicationEvidence || null,
    firstRetrievedAt: candidate.firstRetrievedAt,
    lastFetchedAt: candidate.lastRetrievedAt || now,
    updatedAt: now,
    acceptedContracts: analysis.contracts,
    automaticAnalysis: {
      method: "explicit-source-fields-and-keywords",
      domain: analysis.domain,
      locationProvenance: location.provenance,
      ...(location.countryBasis ? { countryBasis: location.countryBasis } : {}),
    },
    location: {
      label: location.city,
      region: location.region,
      commune: location.commune,
    },
    lastVerifiedAt: null,
    technicalReviewAt: null,
  });
  offer.contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        title: offer.title,
        company: offer.company.name,
        description: offer.description,
        location: offer.location,
        domain: offer.domain,
        contracts: offer.acceptedContracts,
        publishedAt: offer.sourcePublishedAt,
        publicationEvidence: offer.publicationEvidence,
        sourceUrl: offer.sourceUrl,
        applicationUrl: offer.applicationUrl,
        expiresAt: offer.expiresAt,
      }),
    )
    .digest("hex");
  return nonComplianceReasons(offer, Date.parse(now)).length ? null : offer;
}
