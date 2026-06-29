import {
  ListingProviderSource,
  ListingProviderStatus,
  ListingSearchQuery,
  NormalizedListing
} from "./listing.types";

export interface ListingProviderAdapter {
  readonly providerId?: string;
  readonly source: ListingProviderSource;
  readonly providerStatus: ListingProviderStatus;
  search(query: ListingSearchQuery): NormalizedListing[] | Promise<NormalizedListing[]>;
}
