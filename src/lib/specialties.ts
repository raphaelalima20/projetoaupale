/** profiles.specialty stores multiple specialties as a single comma-separated string. */
export function parseSpecialties(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatSpecialties(value: string | null | undefined): string {
  return parseSpecialties(value).join(", ");
}
