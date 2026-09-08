export type FarmerRecord = {
  id: string;
  createdAt: string;
  farmerName: string;
  farmerId: string;
  aadhaar: string;
  mobile: string;
  surveyNumber: string;
  state: string;
  district: string;
  village: string;
  crops?: string[];
  otherCrop?: string;
};

const KEY = "agriconnect.registrations";
const PENDING_KEY = "agriconnect.pendingId";

function canStore() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function listRegistrations(): FarmerRecord[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as FarmerRecord[]) : [];
  } catch {
    return [];
  }
}

function save(records: FarmerRecord[]) {
  if (!canStore()) return;
  window.localStorage.setItem(KEY, JSON.stringify(records));
}

export function addRegistration(data: Omit<FarmerRecord, "id" | "createdAt">): FarmerRecord {
  const record: FarmerRecord = {
    ...data,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  save([record, ...listRegistrations()]);
  if (canStore()) window.localStorage.setItem(PENDING_KEY, record.id);
  return record;
}

export function getPendingId(): string | null {
  if (!canStore()) return null;
  return window.localStorage.getItem(PENDING_KEY);
}

export function clearPendingId() {
  if (canStore()) window.localStorage.removeItem(PENDING_KEY);
}

export function updateCrops(id: string, crops: string[], otherCrop?: string) {
  const records = listRegistrations().map((r) =>
    r.id === id ? { ...r, crops, otherCrop } : r,
  );
  save(records);
}
