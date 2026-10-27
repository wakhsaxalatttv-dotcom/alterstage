export type OfferStatus = "active" | "expired" | "withdrawn" | "to_verify";
export type ModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";
export interface PublicContact {
  value: string;
  type: "email";
  provenance: string;
  role: "RH" | "Tutorat" | "Recrutement" | null;
}
export interface Company {
  id: string;
  name: string;
  website: string | null;
  sector: string | null;
  description: string | null;
  type: string | null;
  size: string | null;
  location: string | null;
  locations: string[];
  stack: string[];
  rhythm: string | null;
  certifications: string[];
  tags: string[];
  logoUrl?: string | null;
  profileSourceUrl: string | null;
  profileVerifiedAt?: string | null;
  researchLead?: boolean;
  publicContacts?: PublicContact[];
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
  origin: "employer" | "editorial" | "feed";
  sourceId?: string;
  sourcePolicyApproved?: boolean;
  sourceExpiresAt?: string | null;
  sourcePartner?: string | null;
  sourceStatus?: string | null;
  acceptedContracts?: string[];
  sourceName?: string;
  externalId?: string;
  contentHash?: string;
  publishedAt: string | null;
  sourcePublishedAt?: string | null;
  sourceUpdatedAt?: string | null;
  firstRetrievedAt: string;
  lastFetchedAt?: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
  technicalReviewAt?: string;
  status: OfferStatus;
  moderationStatus: ModerationStatus;
  expiresAt: string;
  publicContacts: PublicContact[];
  description: string;
  skills: string[];
  missions: string[];
  technologies?: string[];
  extractedKeywords?: {
    technologies: string[];
    education: string[];
    locations: string[];
    method: string;
  };
  duration: string | null;
  startsAt: string | null;
  sponsored: boolean;
  submittedAt: string;
  reuse?: { licenseUrl: string; authorizationRef: string | null };
  detailsComplete?: boolean;
}
export interface SourceDefinition {
  id: string;
  name: string;
  kind: "json" | "rss" | "lba";
  url: string;
  allowedHosts: string[];
  enabled: boolean;
  authorized: boolean;
  licenseUrl: string;
  authorizationRef?: string;
  tokenEnv?: string;
  defaults?: Record<string, unknown>;
}
/** Adapters return untrusted records; normalization and moderation are mandatory downstream. */
export interface SourceConnector {
  id: string;
  load(): Promise<unknown[]>;
}
export interface Paginated<T> {
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  offers: T[];
}
export interface UserRepository<T> {
  list(userId: string): Promise<T[]>;
  save(userId: string, value: T): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
}
