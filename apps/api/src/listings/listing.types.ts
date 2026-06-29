export type ListingProviderSource =
  | "mock_provider"
  | "crea_ddf_pending_access"
  | "repliers_preview";

export type ListingProviderStatus =
  | "mock_only"
  | "pending_access"
  | "preview_ready"
  | "preview_disabled"
  | "preview_not_configured"
  | "preview_error";

export interface ListingSearchQuery {
  q?: string;
  location?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  intent?: string;
  provider?: "mock_provider" | "crea_ddf" | "repliers_preview";
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
  priceLabel?: string;
  neighbourhood?: string;
  description?: string;
  propertyType?: string;
  squareFeet?: number | null;
  tags?: string[];
  intent?: string | null;
  providerStatus?: ListingProviderStatus;
}

export interface ListingsSearchResponse {
  source: ListingProviderSource;
  providerStatus: ListingProviderStatus;
  disclaimer: string;
  blockedReason?: string;
  results: NormalizedListing[];
}
