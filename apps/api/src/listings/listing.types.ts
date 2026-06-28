export type ListingProviderSource = "mock_provider";

export type ListingProviderStatus = "mock_only";

export interface ListingSearchQuery {
  q?: string;
  location?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  intent?: string;
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
  results: NormalizedListing[];
}
