'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time-format';
import { ReportComments } from '@/components/ReportComments';

interface FeedEntry {
  id: string;
  description: string | null;
  countryName: string | null;
  casualties: number;
  createdAt: number;
  media: { url: string; contentType: string };
  canEdit: boolean;
  canDelete: boolean;
}

export function LiveFeed() {
  const [reports, setReports] = useState<FeedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setIsAuthenticated(Boolean(data.authenticated));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleDeleted(id: string) {
    setReports((prev) => (prev ? prev.filter((report) => report.id !== id) : prev));
  }

  function handleUpdated(id: string, description: string | null, casualties: number) {
    setReports((prev) =>
      prev ? prev.map((report) => (report.id === id ? { ...report, description, casualties } : report)) : prev,
    );
  }

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
            <FeedReportCard
              key={report.id}
              report={report}
              isAuthenticated={isAuthenticated}
              isLast={i === reports.length - 1}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedReportCard({
  report,
  isAuthenticated,
  isLast,
  onDeleted,
  onUpdated,
}: {
  report: FeedEntry;
  isAuthenticated: boolean;
  isLast: boolean;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, description: string | null, casualties: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState(report.description ?? '');
  const [casualtiesInput, setCasualtiesInput] = useState(String(report.casualties));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveEdit() {
    const casualties = Number(casualtiesInput);
    if (!Number.isInteger(casualties) || casualties < 0) {
      setError('Number of people affected must be a non-negative integer');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descriptionInput, casualties }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save changes');

      onUpdated(report.id, data.report.description, data.report.casualties);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${report.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not delete report');

      onDeleted(report.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete report');
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
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

      {editing ? (
        <div style={{ marginBottom: 6 }}>
          <textarea
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            placeholder="Description"
            rows={2}
            style={{ width: '100%', marginBottom: 6 }}
          />
          <input
            type="number"
            min={0}
            value={casualtiesInput}
            onChange={(e) => setCasualtiesInput(e.target.value)}
            placeholder="People affected"
            style={{ marginBottom: 6 }}
          />
          <div className="row" style={{ gap: 6 }}>
            <button onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditing(false);
                setDescriptionInput(report.description ?? '');
                setCasualtiesInput(String(report.casualties));
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {report.description && (
            <p style={{ margin: '0 0 4px', fontSize: 13.5, color: 'var(--text)' }}>{report.description}</p>
          )}
          {report.casualties > 0 && (
            <span className="status-text error" style={{ marginTop: 0, fontSize: 12.5 }}>
              {report.casualties} {report.casualties === 1 ? 'person' : 'people'} affected
            </span>
          )}
        </>
      )}

      {(report.canEdit || report.canDelete) && !editing && (
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          {report.canEdit && (
            <button className="ghost" onClick={() => setEditing(true)} style={{ fontSize: 12.5 }}>
              Edit
            </button>
          )}
          {report.canDelete && (
            <button className="ghost" onClick={handleDelete} disabled={deleting} style={{ fontSize: 12.5 }}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="status-text error" style={{ fontSize: 12 }}>
          {error}
        </p>
      )}

      <ReportComments reportId={report.id} isAuthenticated={isAuthenticated} />
    </div>
  );
}
