import path from "node:path";
import { writeFile } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { publicOffer } from "../server/domain.js";
const store = new OfferStore(process.env.DATA_DIR || path.resolve(".local"));
try {
  const rows = (await store.read())
    .filter(
      (o) =>
        o.sourceId === "la-bonne-alternance" &&
        o.sourcePolicyApproved &&
        publicOffer(o) &&
        !o.lastVerifiedAt,
    )
    .map((o) => ({ ...o, publicContacts: [] }));
  const snapshot = {
    source: "la-bonne-alternance",
    collectedAt: new Date().toISOString(),
    termsUrl:
      "https://api.apprentissage.beta.gouv.fr/fr/explorer/recherche-offre",
    useRestriction:
      "Usage gratuit et non lucratif uniquement selon les conditions de l’API. Ne pas revendre ces données.",
    notice:
      "Offres signalées actives par la source lors de la collecte. Publication d’origine conservée ; les offres anciennes restent non revérifiées.",
    offers: rows,
  };
  await writeFile(
    new URL("../config/market-offers.json", import.meta.url),
    JSON.stringify(snapshot, null, 2) + "\n",
  );
  console.log(
    `Instantané public créé : ${rows.length} offres d’alternance, sans clé ni contact personnel.`,
  );
} finally {
  store.close();
}
