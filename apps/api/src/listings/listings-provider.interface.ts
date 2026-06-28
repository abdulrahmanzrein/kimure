import {
  ListingProviderSource,
  ListingProviderStatus,
  ListingSearchQuery,
  NormalizedListing
} from "./listing.types";

export interface ListingProviderAdapter {
  readonly source: ListingProviderSource;
  readonly providerStatus: ListingProviderStatus;
  search(query: ListingSearchQuery): NormalizedListing[];
}
