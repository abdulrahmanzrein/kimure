#!/usr/bin/env node
"use strict";

const provider = "repliers_preview";
const smoke = "image_shape";
const requiredBaseUrl = "https://api.repliers.io";
const endpointPath = "/listings";
const resultLimit = 3;

async function main() {
  const readiness = getReadiness(process.env);

  if (!readiness.ready) {
    printSafe({
      provider,
      smoke,
      blockedReason: readiness.blockedReason,
      missingKeys: readiness.missingKeys,
      safeToRunLiveCall: false
    });
    process.exitCode = 1;
    return;
  }

  const response = await fetch(`${requiredBaseUrl}${endpointPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "REPLIERS-API-KEY": process.env.REPLIERS_API_KEY
    },
    body: JSON.stringify(buildSmokeRequestBody())
  });

  const body = await response.json().catch(() => ({}));
  const listings = extractListings(body);

  printSafe({
    provider,
    smoke,
    httpStatus: response.status,
    resultCount: listings.length,
    listings: listings.slice(0, resultLimit).map((listing, index) =>
      describeListingShape(listing, index)
    )
  });
}

function getReadiness(env) {
  const missingKeys = [];

  if (env.REPLIERS_ENABLED !== "true") missingKeys.push("REPLIERS_ENABLED");
  if (env.REPLIERS_PROVIDER_CALLS_ENABLED !== "true") {
    missingKeys.push("REPLIERS_PROVIDER_CALLS_ENABLED");
  }
  if (env.REPLIERS_IMAGE_SHAPE_SMOKE_ENABLED !== "true") {
    missingKeys.push("REPLIERS_IMAGE_SHAPE_SMOKE_ENABLED");
  }
  if (env.REPLIERS_API_BASE_URL !== requiredBaseUrl) {
    missingKeys.push("REPLIERS_API_BASE_URL");
  }
  if (!readString(env.REPLIERS_API_KEY)) missingKeys.push("REPLIERS_API_KEY");

  return {
    ready: missingKeys.length === 0,
    missingKeys,
    blockedReason: missingKeys.length
      ? "repliers_image_shape_smoke_not_enabled_or_configured"
      : null
  };
}

function buildSmokeRequestBody() {
  return {
    limit: resultLimit,
    hasImages: true,
    fields: [
      "images[5]",
      "address",
      "details",
      "listPrice",
      "price",
      "class",
      "type",
      "propertyType",
      "status",
      "lastStatus"
    ]
  };
}

function extractListings(value) {
  const body = asRecord(value);
  if (Array.isArray(body.listings)) return body.listings;
  if (Array.isArray(body.results)) return body.results;
  if (Array.isArray(body.data)) return body.data;
  return [];
}

function describeListingShape(value, index) {
  const listing = asRecord(value);

  return {
    index,
    topLevelKeys: Object.keys(listing).sort(),
    imageLikeFields: {
      images: describeCollectionField(listing.images),
      photos: describeCollectionField(listing.photos),
      media: describeCollectionField(listing.media),
      gallery: describeCollectionField(listing.gallery)
    },
    firstImageShape: describeFirstImageShape([
      listing.images,
      listing.photos,
      listing.media,
      listing.gallery
    ])
  };
}

function describeCollectionField(value) {
  return {
    exists: value !== undefined && value !== null,
    type: getShapeType(value),
    length: Array.isArray(value) || typeof value === "string"
      ? value.length
      : value && typeof value === "object"
        ? Object.keys(value).length
        : 0
  };
}

function describeFirstImageShape(values) {
  const image = values.flatMap(toArray).find((item) => item !== undefined && item !== null);
  const record = asRecord(image);
  const keys = Object.keys(record).sort();

  if (typeof image === "string") {
    return {
      type: "string",
      keys: [],
      hasUrl: looksUrlLike(image),
      hasSrc: false,
      hasCdnUrl: false,
      hasOriginal: false,
      hasLarge: false,
      hasMedium: false,
      hasSmall: false
    };
  }

  return {
    type: getShapeType(image),
    keys,
    hasUrl: hasUrlLikeValue(record.url),
    hasSrc: hasUrlLikeValue(record.src),
    hasCdnUrl: hasUrlLikeValue(record.cdnUrl),
    hasOriginal: hasUrlLikeValue(record.original),
    hasLarge: hasUrlLikeValue(record.large),
    hasMedium: hasUrlLikeValue(record.medium),
    hasSmall: hasUrlLikeValue(record.small)
  };
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function hasUrlLikeValue(value) {
  return typeof value === "string" && looksUrlLike(value);
}

function looksUrlLike(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function getShapeType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function printSafe(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  printSafe({
    provider,
    smoke,
    blockedReason: "repliers_image_shape_smoke_failed",
    errorCode: error && error.name ? error.name : "unknown_error",
    safeToRunLiveCall: false
  });
  process.exitCode = 1;
});
