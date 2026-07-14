'use client';

import { useEffect, useState } from 'react';

interface CountryTally {
  countryCode: string;
  countryName: string;
  count: number;
}

export function CountryLeaderboard() {
  const [countries, setCountries] = useState<CountryTally[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/leaderboard')
      .then((res) => {
        if (!res.ok) throw new Error('Leaderboard request failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCountries(data.countries ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the leaderboard right now.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5 21V4a1 1 0 0 1 1-1h9l-1.2 4H19a1 1 0 0 1 .8 1.6L17 13l2.8 4.4a1 1 0 0 1-.8 1.6H6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Hazard reports by country
      </div>

      {error && <p className="status-text error">{error}</p>}

      {!error && countries === null && <p className="muted">Loading leaderboard...</p>}

      {!error && countries && countries.length === 0 && (
        <p className="muted">No hazardous events reported yet. Be the first to report one.</p>
      )}

      {!error && countries && countries.length > 0 && (
        <>
          <div>
            {countries.map((c, i) => (
              <div
                key={c.countryCode}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: i < countries.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span>
                  <strong style={{ color: 'var(--accent)', marginRight: 10 }}>#{i + 1}</strong>
                  {c.countryName}
                </span>
                <span className="muted">
                  {c.count} report{c.count === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            {total} total report{total === 1 ? '' : 's'} across {countries.length} countr
            {countries.length === 1 ? 'y' : 'ies'}.
          </p>
        </>
      )}
    </div>
  );
}
