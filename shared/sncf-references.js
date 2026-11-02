// Extracted from the user-supplied SNCF HTML, not a live availability check.
// The saved page contains one eligible stage record; its detailed description
// and external application link are empty. No missions/contact are invented.
export const sncfReferences = [
  {
    id: "sncf-886156",
    title: "STAGE - Suivi sismique par fibre optique de travaux de plateforme ferroviaire",
    company: { name: "SNCF RÉSEAU" },
    companyWebsite: "https://emploi.sncf.com",
    companySummary: null,
    location: { label: "Saint-Denis", region: "Île-de-France" },
    contract: "Stage",
    publishedAt: "2026-11-02",
    sourcePublishedAt: "2026-11-02T09:48:39+00:00",
    sourceUpdatedAt: "2026-11-02T09:48:40+00:00",
    sourceConsultedAt: "2026-11-02",
    sourceName: "SNCF — site employeur",
    // Route template observed in the saved SNCF cards, using the original job ID.
    // This individual page has not been fetched from this network.
    sourceUrl: "https://emploi.sncf.com/nos-offres/886156",
    applicationUrl: "https://emploi.sncf.com/nos-offres/886156",
    domain: "Bâtiment, génie civil & travaux publics",
    education: ["Bac + 5 et plus"],
    duration: "6 mois",
    summary:
      "SNCF Réseau propose un stage de six mois à Saint-Denis, en Seine-Saint-Denis, consacré au suivi sismique par fibre optique de travaux de plateforme ferroviaire. Le niveau de formation indiqué est Master, ingénieur ou Bac+5. La description détaillée des missions n’est pas présente dans la page de liste fournie ; consultez la fiche SNCF pour connaître les conditions et candidater.",
    missions: [],
    profile: "Niveau 7 : Master, ingénieur ou Bac+5. Débutant — première expérience.",
    technologies: ["Fibre optique"],
    status: "to_verify",
    lastVerifiedAt: null,
    sourceDocument: {
      kind: "uploaded-html",
      fileName: "Nos Offres _ Emploi SNCF.html",
      sha256: "719b5de8746544b6d2b582287c2a2b2d1b60cb9637a00b6b173b4a554d6f14eb",
      recordId: "886156",
      analyzedAt: "2026-11-02",
      descriptionAvailable: false,
      onlineAvailabilityChecked: false,
    },
  },
];
