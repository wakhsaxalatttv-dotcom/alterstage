import { convert } from "html-to-text";
export const technologyRules = {
  JavaScript: /\bjavascript\b/i,
  TypeScript: /\btypescript\b/i,
  Python: /\bpython\b/i,
  Java: /\bjava\b/i,
  "C++": /\bc\+\+(?=\W|$)/i,
  "C#": /\bc#(?=\W|$)/i,
  PHP: /\bphp\b/i,
  React: /\breact(?:\.js)?\b/i,
  Angular: /\bangular\b/i,
  Vue: /\bvue(?:\.js)?\b/i,
  "Node.js": /\bnode(?:\.js|js)\b/i,
  Linux: /\blinux\b/i,
  Windows: /\bwindows\b/i,
  Cisco: /\bcisco\b/i,
  VLAN: /\bvlan\b/i,
  "TCP/IP": /\btcp\s*\/\s*ip\b/i,
  Fibre: /\bfibre(?:\s+optique)?\b/i,
  "5G": /\b5g\b/i,
  Docker: /\bdocker\b/i,
  Kubernetes: /\bkubernetes|\bk8s\b/i,
  AWS: /\baws\b/i,
  Azure: /\bazure\b/i,
  Terraform: /\bterraform\b/i,
  SQL: /\bsql\b/i,
  PostgreSQL: /\bpostgres(?:ql)?\b/i,
  Git: /\bgit\b/i,
  Ansible: /\bansible\b/i,
  VMware: /\bvmware\b/i,
  AutoCAD: /\bautocad\b/i,
  SolidWorks: /\bsolidworks\b/i,
  Siemens: /\bsiemens\b/i,
  SAP: /\bsap\b/i,
};
export const technologies = Object.keys(technologyRules);
export function plainText(value, limit = 12000) {
  return convert(typeof value === "string" ? value.slice(0, 60000) : "", {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
    ],
  })
    .replace(
      /[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[A-Za-z]{2,}/g,
      "[contact retiré — utiliser le lien officiel]",
    )
    .replace(
      /(?:\+33|0033|0)[1-9](?:[ .-]?\d{2}){4}\b/g,
      "[téléphone retiré — candidature par le lien officiel]",
    )
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}
export function extractKeywords(text) {
  const found = technologies.filter((t) => technologyRules[t].test(text));
  const levels = [...text.matchAll(/\bbac\s*\+\s*([2-8])\b/gi)].map(
    (m) => `Bac + ${m[1]}`,
  );
  const normalized = searchText(text);
  const locations = [
    "Paris",
    "Lyon",
    "Marseille",
    "Nantes",
    "Rennes",
    "Toulouse",
    "Bordeaux",
    "Lille",
    "Grenoble",
    "Montpellier",
    "Strasbourg",
    "Nice",
    "Brest",
    "Rouen",
    "Angers",
    "Tours",
    "Dijon",
    "Clermont-Ferrand",
    "Nancy",
    "Metz",
    "Saint-Étienne",
    "Orléans",
    "Poitiers",
    "Limoges",
    "La Rochelle",
    "Caen",
  ].filter((city) =>
    new RegExp("(?:^|[^a-z])" + searchText(city) + "(?:$|[^a-z])").test(
      normalized,
    ),
  );
  return {
    locations,
    technologies: found,
    education: [...new Set(levels)],
    method: "règles lexicales — mentions du texte, pas exigences confirmées",
  };
}
export const searchText = (value) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
