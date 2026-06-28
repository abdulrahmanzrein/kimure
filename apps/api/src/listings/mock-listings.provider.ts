import { Injectable } from "@nestjs/common";
import { ListingSearchQuery, NormalizedListing } from "./listing.types";
import { ListingProviderAdapter } from "./listings-provider.interface";

const MOCK_LISTINGS: NormalizedListing[] = [
  {
    id: "mock-ottawa-family-home",
    title: "Sample family home near parks and transit",
    type: "detached",
    price: 685000,
    location: "Ottawa, Ontario",
    addressSummary: "West Ottawa neighbourhood sample",
    bedrooms: 3,
    bathrooms: 2,
    propertySize: "1,850 sq ft",
    listingStatus: "sample_available",
    imageUrl: null,
    sourceProvider: "mock_provider",
    isLiveProviderData: false,
    matchSignals: ["family-friendly", "transit access", "primary residence"]
  },
  {
    id: "mock-toronto-rental-condo",
    title: "Sample downtown rental condo",
    type: "condo",
    price: 2850,
    location: "Toronto, Ontario",
    addressSummary: "Central Toronto rental sample",
    bedrooms: 2,
    bathrooms: 2,
    propertySize: "820 sq ft",
    listingStatus: "sample_available",
    imageUrl: null,
    sourceProvider: "mock_provider",
    isLiveProviderData: false,
    matchSignals: ["rental", "walkable", "commuter-friendly"]
  },
  {
    id: "mock-calgary-investment-townhome",
    title: "Sample investment townhome",
    type: "townhome",
    price: 525000,
    location: "Calgary, Alberta",
    addressSummary: "Northwest Calgary investment sample",
    bedrooms: 3,
    bathrooms: 3,
    propertySize: "1,620 sq ft",
    listingStatus: "sample_available",
    imageUrl: null,
    sourceProvider: "mock_provider",
    isLiveProviderData: false,
    matchSignals: ["investment", "rental potential", "growth corridor"]
  },
  {
    id: "mock-rural-land-eastern-ontario",
    title: "Sample rural land parcel",
    type: "land",
    price: 240000,
    location: "Eastern Ontario",
    addressSummary: "Rural acreage sample",
    bedrooms: 0,
    bathrooms: 0,
    propertySize: "18 acres",
    listingStatus: "sample_available",
    imageUrl: null,
    sourceProvider: "mock_provider",
    isLiveProviderData: false,
    matchSignals: ["rural land", "long-term hold", "development due diligence"]
  }
];

function includesText(value: string, search: string) {
  return value.toLowerCase().includes(search);
}

@Injectable()
export class MockListingsProvider implements ListingProviderAdapter {
  readonly source = "mock_provider" as const;
  readonly providerStatus = "mock_only" as const;

  // This provider is intentionally mock-only. A licensed provider such as CREA
  // DDF, MLS/IDX, or another approved listing API can later replace this class
  // while keeping the controller response contract stable.
  search(query: ListingSearchQuery): NormalizedListing[] {
    return MOCK_LISTINGS.filter((listing) => {
      const q = query.q?.trim().toLowerCase();
      const location = query.location?.trim().toLowerCase();
      const type = query.type?.trim().toLowerCase();
      const intent = query.intent?.trim().toLowerCase();

      if (q) {
        const searchable = [
          listing.title,
          listing.type,
          listing.location,
          listing.addressSummary,
          listing.listingStatus,
          ...listing.matchSignals
        ].join(" ");

        if (!includesText(searchable, q)) return false;
      }

      if (location && !includesText(listing.location, location)) return false;
      if (type && !includesText(listing.type, type)) return false;
      if (typeof query.minPrice === "number" && listing.price < query.minPrice) return false;
      if (typeof query.maxPrice === "number" && listing.price > query.maxPrice) return false;
      if (typeof query.bedrooms === "number" && listing.bedrooms < query.bedrooms) return false;
      if (intent && !listing.matchSignals.some((signal) => includesText(signal, intent))) return false;

      return true;
    });
  }
}

export { MOCK_LISTINGS };
