import React from "react";
import { FlaskConical, Code2, Cable, Cpu, Wrench, Zap } from "lucide-react";
const themes = {
  chemistry: {
    label: "Chimie & matériaux",
    color: "#7650a2",
    soft: "#f4effa",
    Icon: FlaskConical,
  },
  software: {
    label: "Informatique & data",
    color: "#2467a8",
    soft: "#eef5fc",
    Icon: Code2,
  },
  networks: {
    label: "Réseaux & télécoms",
    color: "#067c87",
    soft: "#eaf7f8",
    Icon: Cable,
  },
  embedded: {
    label: "Électronique & systèmes",
    color: "#a74a20",
    soft: "#fff2ea",
    Icon: Cpu,
  },
  energy: {
    label: "Énergie & électricité",
    color: "#94630c",
    soft: "#fff7e4",
    Icon: Zap,
  },
  industry: {
    label: "Industrie & technique",
    color: "#9b4d70",
    soft: "#fcf0f5",
    Icon: Wrench,
  },
};
export function offerTheme(domain = "") {
  if (/chimie|matériaux|procédés/i.test(domain)) return themes.chemistry;
  if (/réseaux|télécom|cloud/i.test(domain)) return themes.networks;
  if (/embarqué|électronique|automati/i.test(domain)) return themes.embedded;
  if (/énergie|électricité/i.test(domain)) return themes.energy;
  if (/logiciel|informatique|data|cybersécurité/i.test(domain))
    return themes.software;
  return themes.industry;
}
export function OfferVisual({ domain }) {
  const { label, Icon } = offerTheme(domain);
  return (
    <div className="sector-visual" aria-hidden="true">
      <span className="sector-symbol">
        <Icon size={24} strokeWidth={1.6} />
      </span>
      <span>{label}</span>
      <svg className="sector-pattern" viewBox="0 0 160 64">
        <circle cx="122" cy="30" r="37" />
        <circle cx="122" cy="30" r="23" />
        <path d="M0 54h56l20-28h50" />
      </svg>
    </div>
  );
}
export const offerColors = (domain) => {
  const { color, soft } = offerTheme(domain);
  return { "--offer-accent": color, "--offer-tint": soft };
};
