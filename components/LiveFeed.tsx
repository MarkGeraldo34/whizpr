'use client';

import { useEffect, useState } from 'react';

interface FeedEntry {
  id: string;
  description: string | null;
  countryName: string | null;
  casualties: number;
  createdAt: number;
  media: { url: string; contentType: string };
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LiveFeed() {
  const [reports, setReports] = useState<FeedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/feed')
      .then((res) => {
        if (!res.ok) throw new Error('Feed request failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setReports(data.reports ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the live feed right now.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card">
      <div className="card-title alert-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="2.4" fill="currentColor" />
            <path
              d="M12 4v3.2M12 16.8V20M20 12h-3.2M7.2 12H4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Live feed
      </div>
      <p className="muted" style={{ marginBottom: 8 }}>
        Reports are posted here as soon as they're submitted, including the reported photo/video —
        reporter identity always stays private.
      </p>

      {error && <p className="status-text error">{error}</p>}

      {!error && reports === null && <p className="muted">Loading feed...</p>}

      {!error && reports && reports.length === 0 && (
        <p className="muted">No reports yet. Submitted alerts will appear here.</p>
      )}

      {!error && reports && reports.length > 0 && (
        <div>
          {reports.map((report, i) => (
            <div
              key={report.id}
              style={{
                padding: '10px 0',
                borderBottom: i < reports.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{report.countryName ?? 'Unknown location'}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {timeAgo(report.createdAt)}
                </span>
              </div>
              {report.media.contentType.startsWith('video/') ? (
                <video
                  src={report.media.url}
                  controls
                  style={{ width: '100%', maxHeight: 320, borderRadius: 8, marginBottom: 6 }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- remote user-uploaded
                // media with an unpredictable Blob storage hostname; next/image would need
                // that hostname allowlisted in next.config.js ahead of time.
                <img
                  src={report.media.url}
                  alt={report.description ?? 'Reported emergency media'}
                  style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }}
                />
              )}
              {report.description && (
                <p style={{ margin: '0 0 4px', fontSize: 13.5, color: 'var(--text)' }}>{report.description}</p>
              )}
              {report.casualties > 0 && (
                <span className="status-text error" style={{ marginTop: 0, fontSize: 12.5 }}>
                  {report.casualties} {report.casualties === 1 ? 'person' : 'people'} affected
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
