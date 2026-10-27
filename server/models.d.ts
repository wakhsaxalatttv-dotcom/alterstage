export type OfferStatus = "active" | "expired" | "withdrawn" | "to_verify";
export type ModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";
export interface Company {
  id: string;
  name: string;
  sector: string | null;
  website: string;
  location: string;
  description: string | null;
}
export interface Offer {
  id: string;
  title: string;
  company: Company;
  contract: "Stage" | "Apprentissage" | "Contrat de professionnalisation";
  location: { label: string; commune: string | null; region: string };
  domain: string;
  education: string[];
  sourceUrl: string;
  applicationUrl: string;
  source: string;
  origin: "employer" | "editorial";
  publishedAt: string | null;
  firstRetrievedAt: string;
  lastVerifiedAt: string | null;
  status: OfferStatus;
  moderationStatus: ModerationStatus;
  /** Internal catalogue deadline, not a closing date inferred from the original source. */
  expiresAt: string;
  publicContacts: { value: string; type: "email"; provenance: string }[];
  description: string;
  skills: string[];
  missions: string[];
  duration: string | null;
  startsAt: string | null;
  sponsored: boolean;
  submittedAt: string;
}
/** Future authorized feed adapters must enter the moderation queue, never publish directly. */
export interface SourceConnector {
  id: string;
  load(): Promise<Offer[]>;
}
export interface UserRepository<T> {
  list(userId: string): Promise<T[]>;
  save(userId: string, value: T): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
}
