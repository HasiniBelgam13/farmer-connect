// Rule-based "intelligence" layer used by booking/queue server functions.
// Kept dependency-free and pure so it can run on the server, in tests, or in
// a future edge function without touching Supabase.

export type CentreCandidate = {
  id: string;
  centreName: string;
  district: string;
  state: string;
  dailyCapacityFarmers: number;
  avgServiceMinutesPerFarmer: number;
  waitingCount: number; // farmers currently in the virtual queue today
};

/**
 * Smart Allocation (methodology step 3):
 * Picks the least-congested centre that serves the farmer's crop, preferring
 * same-district centres, then same-state, then anywhere. This is what powers
 * "Dynamic Centre Load Balancing" from the idea submission.
 */
export function pickBestCentre(
  candidates: CentreCandidate[],
  farmerDistrict: string,
  farmerState: string,
): CentreCandidate | null {
  if (candidates.length === 0) return null;

  const score = (c: CentreCandidate) => {
    const utilisation = c.dailyCapacityFarmers > 0 ? c.waitingCount / c.dailyCapacityFarmers : 1;
    const localityBonus =
      c.district.toLowerCase() === farmerDistrict.toLowerCase()
        ? 0
        : c.state.toLowerCase() === farmerState.toLowerCase()
          ? 0.15
          : 0.35;
    return utilisation + localityBonus;
  };

  return [...candidates].sort((a, b) => score(a) - score(b))[0] ?? null;
}

/**
 * Rule-based ETA+ (Intelligence block from Technical Approach):
 * estimated wait = farmers ahead * average service time for that centre,
 * with a small buffer so alerts land slightly before the real turn.
 */
export function computeEtaMinutes(queuePosition: number, avgServiceMinutesPerFarmer: number): number {
  const aheadOfMe = Math.max(0, queuePosition - 1);
  const buffer = 5;
  return aheadOfMe * avgServiceMinutesPerFarmer + buffer;
}

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Haversine distance in km, used to size the "when to travel" alert. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/** Simple multilingual message templating for the IVR/SMS notification step. */
export function buildTravelAlertMessage(
  language: string,
  centreName: string,
  tokenNumber: number,
  etaMinutes: number,
): string {
  const eta = etaMinutes < 60 ? `${etaMinutes} min` : `${Math.round(etaMinutes / 60)} hr ${etaMinutes % 60} min`;
  const templates: Record<string, string> = {
    en: `KisanSaarthi: Your token #${tokenNumber} at ${centreName} will be called in about ${eta}. Please start travelling now.`,
    hi: `KisanSaarthi: ${centreName} पर आपका टोकन #${tokenNumber} लगभग ${eta} में बुलाया जाएगा। कृपया अभी यात्रा शुरू करें।`,
    te: `KisanSaarthi: ${centreName} వద్ద మీ టోకెన్ #${tokenNumber} సుమారు ${eta}లో పిలవబడుతుంది. దయచేసి ఇప్పుడే బయలుదేరండి.`,
  };
  return templates[language] ?? templates['en']!;
}
