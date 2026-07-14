'use client';

import { useRef, useState } from 'react';

export function ReportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'submitting' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const photoCaptureRef = useRef<HTMLInputElement>(null);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const libraryPickerRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function pickFile(next: File | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next ? URL.createObjectURL(next) : null;
    });
    setFile(next);
    if (message) setMessage(null);
  }

  function clearFile() {
    pickFile(null);
    if (photoCaptureRef.current) photoCaptureRef.current.value = '';
    if (videoCaptureRef.current) videoCaptureRef.current.value = '';
    if (libraryPickerRef.current) libraryPickerRef.current.value = '';
  }

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
          clearFile();
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

      {/* Hidden inputs — `capture` opens the device's native camera app
          directly instead of the file/gallery picker. */}
      <input
        ref={photoCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
      <input
        ref={videoCaptureRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
      <input
        ref={libraryPickerRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />

      <div className="row" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="ghost"
          onClick={() => photoCaptureRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span className="icon-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          Take photo
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => videoCaptureRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span className="icon-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M15 10.5 21 7v10l-6-3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </span>
          Record video
        </button>
        <button type="button" className="ghost" onClick={() => libraryPickerRef.current?.click()}>
          Choose from library
        </button>
      </div>

      {file && (
        <div className="row" style={{ marginBottom: 14, alignItems: 'center' }}>
          {previewUrl && file.type.startsWith('image/') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Captured emergency preview"
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
            />
          )}
          {previewUrl && file.type.startsWith('video/') && (
            <video
              src={previewUrl}
              muted
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
            />
          )}
          <span className="muted" style={{ flex: 1, wordBreak: 'break-all' }}>
            {file.name || 'Captured media'}
          </span>
          <button type="button" className="ghost" onClick={clearFile}>
            Remove
          </button>
        </div>
      )}

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
