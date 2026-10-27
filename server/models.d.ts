export type OfferStatus = 'active' | 'expired' | 'withdrawn' | 'to_verify';
export interface Company {
  id: string; name: string; sector: string | null; website: string | null; location: string | null;
}
export interface Offer {
  id: string; title: string; company: Company;
  contract: 'Stage' | 'Apprentissage' | 'Contrat de professionnalisation';
  location: {label: string | null; commune: string | null; region: string | null};
  domain: string | null; education: string[]; sourceUrl: string; applicationUrl: string;
  source: string; publishedAt: string | null; firstRetrievedAt: string;
  lastVerifiedAt: string | null; status: OfferStatus;
  publicContacts: {value: string; type: string; provenance: string}[];
  description: string | null; skills: string[]; missions: string[];
  duration: string | null; startsAt: string | null; sponsored: boolean;
}
export interface SourceResult {
  status: 'unconfigured' | 'connected' | 'error'; offers: Offer[]; message: string; retrievedAt?: string;
}
export interface SourceConnector { id: string; load(): Promise<SourceResult> }
// Future account adapters can replace browser storage; email delivery belongs on the server.
export interface UserRepository<T> { list(userId: string): Promise<T[]>; save(userId: string, value: T): Promise<void>; remove(userId: string, id: string): Promise<void> }
