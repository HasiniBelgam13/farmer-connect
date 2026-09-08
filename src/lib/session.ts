const KEY = "kisansaarthi.farmerId";

function canStore() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function setCurrentFarmerId(id: string) {
  if (canStore()) window.localStorage.setItem(KEY, id);
}

export function getCurrentFarmerId(): string | null {
  if (!canStore()) return null;
  return window.localStorage.getItem(KEY);
}

export function clearCurrentFarmerId() {
  if (canStore()) window.localStorage.removeItem(KEY);
}

export const CROPS = [
  "Paddy",
  "Wheat",
  "Maize",
  "Pulses",
  "Grains",
  "Oilseeds",
  "Cotton",
  "Jute",
  "Sugarcane",
  "Groundnut",
  "Mirchi",
  "Tea",
  "Other",
];

export function cropSlug(crop: string) {
  return crop.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function cropFromSlug(slug: string) {
  return CROPS.find((c) => cropSlug(c) === slug);
}
