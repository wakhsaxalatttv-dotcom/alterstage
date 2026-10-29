import React from "react";
import { ShieldCheck, BriefcaseBusiness, CircleHelp } from "lucide-react";
export function CompanyHostingBadge({ company }) {
  const status = company.hostingStatus || "unconfirmed";
  const Icon =
    status === "reviewed"
      ? ShieldCheck
      : status === "offers"
        ? BriefcaseBusiness
        : CircleHelp;
  const label =
    status === "reviewed"
      ? "Accueil contrôlé"
      : status === "offers"
        ? "Offres récentes"
        : "Accueil à confirmer";
  const detail =
    status === "reviewed"
      ? `Identité et conditions d’accueil relues sur une source le ${new Date(company.hostingReview.reviewedAt).toLocaleDateString("fr-FR")}. Ce contrôle ne vaut pas certification administrative.`
      : status === "offers"
        ? "Cette entreprise a au moins une annonce récente dans le catalogue. Cela ne confirme pas tous ses critères d’accueil."
        : "Aucun accueil actuel n’est confirmé par une revue récente ou une offre du catalogue.";
  return (
    <span className={`company-hosting ${status}`} title={detail}>
      <Icon size={14} />
      {label}
    </span>
  );
}
