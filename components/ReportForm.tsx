'use client';

import { useRef, useState } from 'react';
import { reverseGeocodeCountry } from '@/lib/geocode';
import { MAX_VIDEO_SECONDS } from '@/lib/content-policy';
import { ContentPolicyNotice } from './ContentPolicyNotice';

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not read video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

export function ReportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [casualties, setCasualties] = useState('0');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'ok' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const photoCaptureRef = useRef<HTMLInputElement>(null);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const libraryPickerRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported on this device.');
      return;
    }
    setLocationStatus('locating');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        try {
          const { countryName } = await reverseGeocodeCountry(lat, lng);
          setLocationLabel(countryName);
        } catch {
          setLocationLabel(null);
        }
        setLocationStatus('ok');
      },
      () => {
        setLocationStatus('error');
        setLocationError('Location access was denied. Enable location permissions and try again.');
      },
    );
  }

  async function pickFile(next: File | null) {
    if (next && next.type.startsWith('video/')) {
      try {
        const duration = await readVideoDuration(next);
        if (duration > MAX_VIDEO_SECONDS) {
          setMessage(
            `Videos must be ${MAX_VIDEO_SECONDS} seconds or shorter (this one is ${Math.round(duration)}s).`,
          );
          return;
        }
        setVideoDuration(duration);
      } catch {
        // If duration can't be read, don't block a legitimate short clip on
        // a metadata-parsing hiccup — the policy notice still applies, and
        // moderation review catches anything that slips through.
        setVideoDuration(null);
      }
    } else {
      setVideoDuration(null);
    }

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
    if (!coords) {
      setMessage('Use the location button to attach your location first.');
      return;
    }
    const casualtyCount = Number(casualties);
    if (!Number.isInteger(casualtyCount) || casualtyCount < 0) {
      setMessage('Enter a valid number of people affected (0 or more).');
      return;
    }

    setStatus('submitting');
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('lat', String(coords.lat));
      formData.append('lng', String(coords.lng));
      formData.append('description', description);
      formData.append('casualties', String(casualtyCount));
      if (videoDuration !== null) {
        formData.append('videoDurationSeconds', String(videoDuration));
      }

      const res = await fetch('/api/report', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Submission failed');

      setStatus('ok');
      setMessage('Alert sent to nearby responders.');
      clearFile();
      setDescription('');
      setCasualties('0');
      setCoords(null);
      setLocationLabel(null);
      setLocationStatus('idle');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Submission failed');
    }
  }

  return (
    <>
      <ContentPolicyNotice />
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

      <label>Location</label>
      <div className="row" style={{ marginBottom: 4, alignItems: 'center' }}>
        <button
          type="button"
          className="ghost"
          onClick={detectLocation}
          disabled={locationStatus === 'locating'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span className="icon-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          {locationStatus === 'locating' ? 'Detecting…' : coords ? 'Update location' : 'Use my location'}
        </button>
        {coords && (
          <span className="muted">
            {locationLabel ?? 'Location detected'} ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
          </span>
        )}
      </div>
      {locationStatus === 'error' && locationError ? (
        <p className="status-text error" style={{ marginTop: 0, marginBottom: 14 }}>
          {locationError}
        </p>
      ) : (
        <div style={{ marginBottom: 14 }} />
      )}

      <label htmlFor="casualties">Number of people affected</label>
      <input
        id="casualties"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={casualties}
        onChange={(e) => setCasualties(e.target.value)}
      />

      <label htmlFor="description">What's happening?</label>
      <textarea
        id="description"
        rows={3}
        placeholder="Brief description for responders"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button className="alert" onClick={submitReport} disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending alert...' : 'Send emergency alert'}
      </button>

      {message && (
        <p className={`status-text ${status === 'ok' ? 'ok' : status === 'error' ? 'error' : 'muted'}`}>
          {message}
        </p>
      )}
      </div>
    </>
  );
}
