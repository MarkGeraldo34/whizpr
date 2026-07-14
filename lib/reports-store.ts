/**
 * Server-side emergency report log, used to power the country leaderboard.
 *
 * Same tradeoff as lib/ledger.ts: the in-memory array below is only suitable
 * for local dev / a single serverless instance's lifetime — for production,
 * swap this for a real database behind the same interface.
 */

export interface StoredReport {
  id: string;
  reporterAddress: string;
  lat: number;
  lng: number;
  countryCode: string | null;
  countryName: string | null;
  createdAt: number;
}

const reports: StoredReport[] = [];

export function recordReport(report: StoredReport): void {
  reports.push(report);
}

export interface CountryTally {
  countryCode: string;
  countryName: string;
  count: number;
}

export function getCountryLeaderboard(): CountryTally[] {
  const tally = new Map<string, CountryTally>();

  for (const report of reports) {
    const code = report.countryCode ?? 'UNKNOWN';
    const name = report.countryName ?? 'Unknown location';
    const existing = tally.get(code);
    if (existing) {
      existing.count += 1;
    } else {
      tally.set(code, { countryCode: code, countryName: name, count: 1 });
    }
  }

  return Array.from(tally.values()).sort((a, b) => b.count - a.count);
}

export function getTotalReportCount(): number {
  return reports.length;
}
