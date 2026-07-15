/**
 * Server-side emergency report log, used to power the country leaderboard
 * and the content-moderation review queue.
 *
 * Same tradeoff as lib/ledger.ts: the in-memory array below is only suitable
 * for local dev / a single serverless instance's lifetime — for production,
 * swap this for a real database behind the same interface.
 */

export type ModerationStatus = 'unreviewed' | 'approved' | 'violation';

export interface StoredReportMedia {
  url: string;
  pathname: string;
  contentType: string;
}

export interface StoredReport {
  id: string;
  reporterAddress: string;
  lat: number;
  lng: number;
  countryCode: string | null;
  countryName: string | null;
  casualties: number;
  description: string | null;
  media: StoredReportMedia;
  moderationStatus: ModerationStatus;
  createdAt: number;
}

const reports: StoredReport[] = [];

export function recordReport(report: StoredReport): void {
  reports.push(report);
}

export function getReportById(id: string): StoredReport | null {
  return reports.find((report) => report.id === id) ?? null;
}

export function setModerationStatus(id: string, status: ModerationStatus): StoredReport | null {
  const report = reports.find((candidate) => candidate.id === id);
  if (!report) return null;
  report.moderationStatus = status;
  return report;
}

export function getReportsForModeration(status?: ModerationStatus): StoredReport[] {
  return reports
    .filter((report) => !status || report.moderationStatus === status)
    .sort((a, b) => b.createdAt - a.createdAt);
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
