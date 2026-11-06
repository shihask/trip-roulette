/**
 * Plain data shapes the engine works on. The create-trip function loads these from Postgres;
 * tests build them by hand. No runtime-specific imports.
 */
import type { DurationCode, TransportMode } from "./trip-request.ts";

export type CostRow = {
  id: string;
  costType: "food" | "parking" | "toll" | "accommodation" | "public_transport" | "guide" | "other";
  label: string;
  unit: "per_person" | "per_vehicle" | "per_group" | "per_room_night";
  transportMode: TransportMode | null;
  amountMinor: number | null;
  minMinor: number | null;
  maxMinor: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isEssential: boolean;
  assumptions: string | null;
  verifiedAt: string | null;
};

export type AccessRow = {
  id: string;
  attractionId: string | null;
  restrictionType: "general" | "seasonal" | "permit" | "entry" | "safety" | "road" | "transport" | "weather";
  isEssential: boolean;
  status: "open" | "restricted" | "closed" | "advisory" | "unknown";
  excludedTransportModes: TransportMode[];
  details: string;
  validFrom: string | null;
  validUntil: string | null;
  verifiedAt: string;
  reviewDueAt: string;
};

export type Attraction = {
  id: string;
  name: string;
  entryFeeMinor: number | null;
  isActive: boolean;
};

export type CatalogueDestination = {
  id: string;
  slug: string;
  name: string;
  district: string;
  destinationType: string;
  latitude: number;
  longitude: number;
  suitableDurations: DurationCode[];
  bestSeasonMonths: number[] | null;
  groupSuitability: Record<string, string>;
  requiresPermit: boolean;
  categories: { slug: string; name: string; isPrimary: boolean }[];
  costs: CostRow[];
  attractions: Attraction[];
  access: AccessRow[];
  image: { storagePath: string | null; externalUrl: string | null; alt: string; credit: string } | null;
};

export type Route = {
  destinationId: string;
  mode: TransportMode;
  distanceKm: number;
  durationMinutes: number;
  provider: string;
  computedAt: string;
};

export type DurationRule = { code: DurationCode; label: string; maxOneWayMinutes: number; nights: number };

export type CurveConfig = { fullScoreAtShare: number; scoreAtLimit: number };

export type AlgorithmConfig = {
  version: string;
  weights: { mood: number; budget: number; travelTime: number; group: number; season: number };
  curves: {
    budget: CurveConfig;
    travelTime: CurveConfig;
    season: { inSeason: number; unknown: number; offSeason: number };
    group: { suitable: number; unknown: number; notSuitable: number };
  };
  diversity: { minDistanceKm: number; preferDistinctPrimaryCategory: boolean };
  flexibleDateWindowDays: number;
};

export type Assumption = { value: number; unit: string; verifiedAt: string; reviewDueAt: string };

export type Catalogue = {
  destinations: CatalogueDestination[];
  /** Routes from the trip's start location, all modes. */
  routes: Route[];
  durationRules: Record<DurationCode, DurationRule>;
  config: AlgorithmConfig;
  assumptions: Record<string, Assumption>;
  /** Active mood categories. */
  moods: { slug: string; name: string }[];
};
