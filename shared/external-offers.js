import { employerReferences } from "./employer-references.js";
// Synthèses éditoriales originales : les annonces complètes restent chez l'employeur.
const entries = [
  {
    id: "191091",
    title: "Stage ingénieur·e système embarqué",
    company: "Safran Electronics & Defense",
    city: "Dijon",
    region: "Bourgogne-Franche-Comté",
    publishedAt: "2026-10-27",
    domain: "Informatique embarquée & IoT",
    education: ["Bac + 5 et plus"],
    path: "dijon/stage-ingenieur-e-systeme-embarque-fh-191091",
    summary:
      "Le stage se déroule au sein du support produit de la direction technique du site de Dijon, dans une équipe travaillant sur les systèmes optroniques. Le projet porte sur un boîtier électronique faisant le lien avec un viseur de nouvelle génération. Il associe conception matérielle, programmation embarquée et intégration : le résultat attendu est un équipement fonctionnel, testé et documenté, utilisable dans un système déjà existant.",
    missions: [
      "Étudier l’architecture du boîtier et définir son interface avec le viseur.",
      "Réaliser l’électronique et programmer le logiciel embarqué associé.",
      "Intégrer le prototype au système existant, conduire la validation et préparer les documents techniques.",
    ],
    profile:
      "Dernière année d’école d’ingénieur en informatique, génie logiciel ou électronique. La source recherche des bases en électronique, physique et Linux, une compréhension des architectures matérielles et logicielles et du temps réel. Les bancs de test automatisés et le chargement de logiciels ou paramètres font partie des connaissances attendues. Matlab, VBA, l’optronique, la robotique et l’impression 3D sont des compléments appréciés.",
    technologies: ["Linux", "Temps réel", "Électronique", "Matlab", "VBA"],
    companySummary:
      "Activités en aéronautique, défense et spatial ; le poste concerne les systèmes optroniques.",
  },
  {
    id: "191021",
    title: "Stage logiciel — outil graphique de paramétrage Yocto",
    company: "Safran Electronics & Defense",
    city: "Massy",
    region: "Île-de-France",
    publishedAt: "2026-10-26",
    domain: "Développement logiciel & web",
    education: ["Bac + 2", "Bac + 3"],
    path: "massy/stage-ingenieur-e-logiciel-developpement-outil-graphique-parametrage-yocto-f-h-fh-191021",
    summary:
      "Dans l’équipe chargée des viseurs optroniques, ce stage vise à faciliter la configuration de Linux pour des équipements embarqués. Le travail consiste à créer une interface graphique permettant aux équipes internes de personnaliser leurs projets Yocto et de générer les images système. Le développement comprend aussi des scripts d’automatisation et des échanges avec les utilisateurs pour améliorer l’ergonomie de l’outil.",
    missions: [
      "Concevoir une interface Python avec Qt ou Tkinter pour configurer les images Yocto.",
      "Prendre en main Ubuntu et Yocto, adapter les fonctions aux usages internes et automatiser des configurations ou tests.",
      "Rédiger les procédures techniques, recueillir les retours de l’équipe et faire évoluer l’interface.",
    ],
    profile:
      "La description s’adresse aux étudiants en BTS ou BUT informatique, malgré la présence du mot « ingénieur » dans l’intitulé original. Des notions d’administration Linux, de réseaux IPv4 et de scripts Python ou Bash sont recherchées. La curiosité, la rigueur et l’envie d’apprendre sont mentionnées.",
    technologies: ["Python", "Qt", "Tkinter", "Yocto", "Linux", "Bash", "IPv4"],
    companySummary:
      "Activités en aéronautique, défense et spatial ; l’équipe développe des équipements optroniques.",
  },
  {
    id: "189999",
    title: "Stage informatique — méthodes et outils engineering",
    company: "Safran Seats",
    city: "Issoudun",
    region: "Centre-Val de Loire",
    publishedAt: "2026-10-22",
    domain: "Développement logiciel & web",
    education: ["Bac + 3"],
    path: "issoudun/stagiaire-informatique-methodes-outils-engineering-hf-fh-189999",
    summary:
      "Au sein de la direction technique, le service Méthodes et Outils Engineering accompagne les équipes d’ingénierie dans l’évolution de leurs pratiques et outils numériques. Le stage contribue à plusieurs projets d’automatisation et d’amélioration du suivi des activités. Il combine développement de petits outils, analyse des besoins et création d’indicateurs, avec un encadrement par le responsable du service. Le périmètre peut évoluer selon le profil et les projets en cours.",
    missions: [
      "Développer des outils pour organiser et suivre les activités techniques.",
      "Automatiser des tâches et améliorer les tableaux de bord et indicateurs.",
      "Comprendre les besoins des utilisateurs, proposer des solutions et produire les guides associés.",
    ],
    profile:
      "Étudiant en licence informatique. La source apprécie des connaissances dans un langage comme Python, VBA, C# ou Java, ainsi qu’Excel et des bases SQL. L’analyse, l’autonomie, l’initiative et la capacité à travailler en équipe sont attendues.",
    technologies: ["Python", "VBA", "C#", "Java", "SQL", "Excel"],
    companySummary:
      "Entreprise spécialisée dans les sièges pour passagers et équipages d’avions et d’hélicoptères.",
  },
  {
    id: "190416",
    title:
      "Stage — connexion des moyens industriels au Monitoring & Control System",
    company: "Safran Nacelles",
    city: "Gonfreville-l’Orcher",
    region: "Normandie",
    publishedAt: "2026-10-21",
    domain: "Automatismes & robotique",
    education: ["Bac + 5 et plus"],
    path: "gonfreville-orcher/stage-connexion-moyens-industriels-au-monitoring-control-system-fh-190416",
    summary:
      "Les équipes Manufacturing Digital et Informatique Industrielle développent une plateforme de supervision des équipements de production. Accompagné par un spécialiste en automatisme, le stagiaire identifie les données utiles aux métiers et prépare leur acheminement vers le Monitoring & Control System. Le projet relie le terrain industriel à l’analyse des données pour améliorer le pilotage des machines, la maintenance et la qualité.",
    missions: [
      "Recueillir les besoins de la production, de la maintenance et de l’informatique industrielle.",
      "Cartographier les capteurs, alarmes, compteurs et paramètres disponibles ; déterminer les fréquences de collecte pertinentes.",
      "Définir les échanges avec la plateforme puis participer aux essais, à la validation et à la mise en service.",
    ],
    profile:
      "Préparation d’un diplôme d’ingénieur Bac + 5 en automatisme, génie industriel, informatique industrielle ou industrie 4.0. Une capacité à analyser et expliquer des informations techniques est attendue, ainsi qu’un intérêt pour le terrain et le travail avec plusieurs métiers. OPC-UA, Modbus, Profinet et Ethernet/IP sont des connaissances appréciées, pas présentées comme obligatoires.",
    technologies: [
      "OPC-UA",
      "Modbus",
      "Profinet",
      "Ethernet/IP",
      "Industrie 4.0",
    ],
    companySummary:
      "Conception, intégration et support de nacelles pour moteurs d’avions.",
  },
  {
    id: "190253",
    title: "Stage — automatisme et informatique industriels",
    company: "Safran Landing Systems",
    city: "Villeurbanne",
    region: "Auvergne-Rhône-Alpes",
    publishedAt: "2026-10-16",
    domain: "Automatismes & robotique",
    education: ["Bac + 5 et plus"],
    path: "villeurbanne/stage-automatisme-informatique-industriels-fh-190253",
    summary:
      "Le projet Expansion Carbone de la division Roues & Freins prépare des lignes automatisées pour une nouvelle usine de freins aéronautiques. Basé sur le site de Villeurbanne, le stage porte sur les choix d’architecture, les standards d’automatisme et la supervision. Il inclut des prototypes d’échanges entre machines et systèmes d’information, avec la possibilité de conduire des essais de faisabilité auprès de fournisseurs.",
    missions: [
      "Comparer les solutions d’automatisme et robotique puis rédiger les standards et spécifications.",
      "Maquetter les échanges entre PC, automates, interfaces opérateur et applications ; développer les écrans de supervision et les structures de données.",
      "Préparer des pilotes de faisabilité selon les solutions retenues et simuler des cellules automatisées en 3D.",
    ],
    profile:
      "Dernière année d’école d’ingénieur ou formation équivalente Bac + 5. Les compétences citées couvrent automatisme, robotique, programmation, informatique industrielle, industrie 4.0, IA et gestion de projet. La source mentionne les outils WMS, WCS, MES et MCS, ainsi que l’anglais, la rigueur et les qualités de communication.",
    technologies: [
      "Automatisme",
      "Robotique",
      "PLC",
      "HMI",
      "MES",
      "WMS",
      "Industrie 4.0",
    ],
    companySummary:
      "Activités liées aux trains d’atterrissage, roues et freins aéronautiques ; poste dans la division Roues & Freins.",
  },
  {
    id: "189462",
    title: "Stage — réalisation d’un outil informatique BI",
    company: "Safran Aircraft Engines",
    city: "Corbeil-Essonnes",
    region: "Île-de-France",
    publishedAt: "2026-10-07",
    domain: "Data, IA & machine learning",
    education: ["Bac + 3", "Bac + 4"],
    path: "corbeil-essonnes/stage-realisation-outil-informatique-bi-fh-189462",
    summary:
      "Rattaché au service ERP du site de Corbeil, le stage Business Intelligence participe à la transformation numérique de la direction des systèmes d’information. Le travail s’appuie sur des données industrielles et se mène avec plusieurs divisions. L’enjeu est de rendre les données exploitables dans des outils de reporting et de visualisation, puis d’aider les équipes opérationnelles à comprendre les indicateurs obtenus.",
    missions: [
      "Contribuer au développement et à l’amélioration des outils de reporting et de visualisation.",
      "Collecter et analyser les données industrielles pour repérer des pistes de performance.",
      "Accompagner les utilisateurs dans l’exploitation des solutions BI et expliquer les indicateurs aux équipes métiers.",
    ],
    profile:
      "La description cite un master, une deuxième année d’école d’ingénieur ou un cursus informatique Bac + 4 ; l’en-tête de la source indique Bac + 3 / Bac + 4. Les outils cités sont Power BI, Tableau, SQL et Excel ; une connaissance des ERP est un plus. Analyse, pédagogie, autonomie, communication et aisance en anglais sont recherchées.",
    technologies: ["Power BI", "Tableau", "SQL", "Excel", "ERP"],
    companySummary:
      "Conception, production, commercialisation et support de moteurs aéronautiques civils et militaires.",
  },
];
const safranReferences = entries.map(
  ({ company, city, region, path, ...entry }) => ({
    ...entry,
    id: `external-safran-${entry.id}`,
    company: { name: company },
    location: { label: city, region },
    contract: "Stage",
    status: "to_verify",
    lastVerifiedAt: null,
    sourceConsultedAt: "2026-10-27",
    sourceName: "Safran — site employeur",
    companyWebsite: "https://www.safran-group.com/fr",
    sourceUrl: `https://www.safran-group.com/fr/offres/france/${path}`,
  }),
);

export const externalOffers = [...safranReferences, ...employerReferences];
