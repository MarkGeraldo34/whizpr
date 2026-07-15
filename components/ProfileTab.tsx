'use client';

import { useEffect, useState } from 'react';

interface Profile {
  address: string;
  username: string | null;
  whizcredits: string;
  banned: boolean;
  banReason: string | null;
}

export function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/profile')
      .then((res) => res.json())
      .then((data: Profile) => {
        if (cancelled) return;
        setProfile(data);
        if (!data.username) setEditing(true);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your profile right now.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveUsername() {
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Could not save username');

      setProfile(data);
      setEditing(false);
      setUsernameInput('');
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not save username');
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M4.5 20c1.4-3.6 4.5-5.5 7.5-5.5s6.1 1.9 7.5 5.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Profile
      </div>

      {profile?.banned && (
        <p className="status-text error" style={{ marginTop: 0 }}>
          Your account is banned for violating Whizpr’s content policy
          {profile.banReason ? `: ${profile.banReason}` : ''}. You can no longer submit emergency
          reports.
        </p>
      )}

      <label>Whizcredits balance</label>
      <div className="balance-display">{profile ? `${profile.whizcredits} Whizcredits` : '—'}</div>

      <label>Username</label>
      {!editing && profile?.username && (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{profile.username}</span>
          <button
            className="ghost"
            onClick={() => {
              setEditing(true);
              setUsernameInput(profile.username ?? '');
            }}
          >
            Change
          </button>
        </div>
      )}

      {editing && (
        <>
          {!profile?.username && (
            <p className="muted" style={{ marginTop: -2, marginBottom: 10 }}>
              Choose a username to finish setting up your account.
            </p>
          )}
          <input
            placeholder="e.g. river_watch"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            maxLength={20}
          />
          <div className="row">
            <button onClick={saveUsername} disabled={status === 'saving' || !usernameInput}>
              {status === 'saving' ? 'Saving...' : 'Save username'}
            </button>
            {profile?.username && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditing(false);
                  setUsernameInput('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="status-text error">{error}</p>}

      <label style={{ marginTop: 14, display: 'block' }}>Wallet address</label>
      <div className="address-box">
        <code>{profile?.address}</code>
      </div>
    </div>
  );
}
