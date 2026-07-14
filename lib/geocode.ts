/**
 * Resolves a lat/lng to a country, server-side, using BigDataCloud's free
 * reverse-geocoding API (no key required). Best-effort: a failed lookup
 * returns nulls rather than blocking report submission — swap for a paid /
 * self-hosted geocoder if volume outgrows the free tier.
 */

export interface ReverseGeocodeResult {
  countryCode: string | null;
  countryName: string | null;
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { countryCode: null, countryName: null };
  }

  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return { countryCode: null, countryName: null };

    const data = await res.json();
    return {
      countryCode: typeof data.countryCode === 'string' && data.countryCode ? data.countryCode : null,
      countryName: typeof data.countryName === 'string' && data.countryName ? data.countryName : null,
    };
  } catch {
    return { countryCode: null, countryName: null };
  }
}
