export interface StoredApplication {
  reference: string;
  programmeId: string;
  programmeName: string;
  cohortName: string;
  submittedAt: string;
}

const STORAGE_KEY = 'shoova.public-applications.v1';

export function readApplications(): StoredApplication[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredApplication[]) : [];
  } catch {
    return [];
  }
}

export function addApplication(application: StoredApplication): void {
  const existing = readApplications().filter(
    (item) => item.reference !== application.reference,
  );
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([application, ...existing].slice(0, 20)),
    );
  } catch {
    // Storage can be unavailable in private browsing; the receipt is still
    // shown on the confirmation page.
  }
}
