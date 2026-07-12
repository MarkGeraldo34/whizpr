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

      {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
