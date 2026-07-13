'use client';

import { useState } from 'react';

export function ReportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'submitting' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function submitReport() {
    if (!file) {
      setMessage('Attach a photo or video of the emergency first.');
      return;
    }

    setStatus('locating');
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('submitting');
        try {
          const formData = new FormData();
          formData.append('media', file);
          formData.append('lat', String(position.coords.latitude));
          formData.append('lng', String(position.coords.longitude));
          formData.append('description', description);

          const res = await fetch('/api/report', { method: 'POST', body: formData });
          const data = await res.json();

          if (!res.ok) throw new Error(data.error ?? 'Submission failed');

          setStatus('ok');
          setMessage('Alert sent to nearby responders.');
          setFile(null);
          setDescription('');
        } catch (err) {
          setStatus('error');
          setMessage(err instanceof Error ? err.message : 'Submission failed');
        }
      },
      () => {
        setStatus('error');
        setMessage('Location access is required to alert nearby responders.');
      },
    );
  }

  return (
    <div className="card">
      <div className="card-title alert-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Report an emergency
      </div>

      <label>Emergency photo or video</label>
      <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <label htmlFor="description">What's happening?</label>
      <textarea
        id="description"
        rows={3}
        placeholder="Brief description for responders"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button className="alert" onClick={submitReport} disabled={status === 'submitting' || status === 'locating'}>
        {status === 'locating' && 'Getting your location...'}
        {status === 'submitting' && 'Sending alert...'}
        {(status === 'idle' || status === 'ok' || status === 'error') && 'Send emergency alert'}
      </button>

      {message && (
        <p className={`status-text ${status === 'ok' ? 'ok' : status === 'error' ? 'error' : 'muted'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
