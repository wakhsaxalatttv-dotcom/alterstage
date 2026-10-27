import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { duplicateOf, publicOffer, ValidationError } from "./domain.js";
export class OfferStore {
  constructor(folder) {
    this.folder = folder;
    this.file = path.join(folder, "offers.json");
    this.queue = Promise.resolve();
  }
  async read() {
    try {
      const data = JSON.parse(await readFile(this.file, "utf8"));
      if (!Array.isArray(data)) throw new Error("Format de données invalide");
      return data;
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
  async mutate(change) {
    const operation = this.queue.then(async () => {
      const rows = await this.read();
      const result = change(rows);
      await mkdir(this.folder, { recursive: true });
      await writeFile(this.file + ".tmp", JSON.stringify(rows, null, 2), {
        mode: 0o600,
      });
      await rename(this.file + ".tmp", this.file);
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async submit(offer) {
    return this.mutate((rows) => {
      if (
        rows.some(
          (o) => o.moderationStatus !== "rejected" && duplicateOf(o, offer),
        )
      )
        throw new ValidationError("Cette annonce est déjà enregistrée.");
      rows.push(offer);
      return { id: offer.id, status: "pending" };
    });
  }
  async publicList() {
    return (await this.read()).map((o) => publicOffer(o)).filter(Boolean);
  }
  async review(id, body) {
    return this.mutate((rows) => {
      const offer = rows.find((o) => o.id === id);
      if (!offer) throw new ValidationError("Annonce introuvable.");
      if (!["approve", "reject", "withdraw"].includes(body.action))
        throw new ValidationError("Action invalide.");
      if (body.action === "approve") {
        if (
          body.sourceChecked !== true ||
          body.rightsChecked !== true ||
          body.companyChecked !== true ||
          body.contactChecked !== true
        )
          throw new ValidationError(
            "Vérifiez la source, les droits, l’entreprise et les contacts avant de publier.",
          );
        if (!offer.publishedAt)
          throw new ValidationError(
            "Une date de publication source est nécessaire avant publication. Corrigez et soumettez à nouveau.",
          );
        if (
          Date.now() - Date.parse(offer.publishedAt) > 30 * 86400000 ||
          Date.parse(offer.expiresAt) + 86400000 <= Date.now()
        )
          throw new ValidationError("Annonce trop ancienne ou expirée.");
        offer.moderationStatus = "approved";
        offer.status = "active";
        offer.lastVerifiedAt = new Date().toISOString();
        offer.source =
          offer.origin === "employer"
            ? "Dépôt direct de l’entreprise"
            : "Site officiel de l’entreprise";
      } else {
        offer.moderationStatus =
          body.action === "reject" ? "rejected" : "withdrawn";
        offer.status = "withdrawn";
      }
      return { id: offer.id, moderationStatus: offer.moderationStatus };
    });
  }
}
