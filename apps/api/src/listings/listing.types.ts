export type ListingProviderSource = "mock_provider" | "crea_ddf_pending_access";

export type ListingProviderStatus = "mock_only" | "pending_access";

export interface ListingSearchQuery {
  q?: string;
  location?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  intent?: string;
  provider?: "mock_provider" | "crea_ddf";
}

export interface NormalizedListing {
  id: string;
  title: string;
  type: string;
  price: number;
  location: string;
  addressSummary: string;
  bedrooms: number;
  bathrooms: number;
  propertySize: string;
  listingStatus: string;
  imageUrl: string | null;
  sourceProvider: ListingProviderSource;
  isLiveProviderData: false;
  matchSignals: string[];
}

export interface ListingsSearchResponse {
  source: ListingProviderSource;
  providerStatus: ListingProviderStatus;
  disclaimer: string;
  blockedReason?: string;
  results: NormalizedListing[];
}
