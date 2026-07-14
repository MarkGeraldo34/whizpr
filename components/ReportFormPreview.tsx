// A non-interactive teaser of the "Report an emergency" card, shown on the
// front page before a wallet is connected — gives visitors a preview of
// what reporting looks like without exposing the real (auth-gated) form.
export function ReportFormPreview() {
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

      <p className="muted" style={{ marginBottom: 14 }}>
        Snap a photo, record a few seconds of video, or attach a file — connect your wallet to
        send it to nearby responders.
      </p>

      <div className="row" style={{ marginBottom: 4 }}>
        <button
          type="button"
          className="ghost"
          disabled
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
          disabled
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
        <button type="button" className="ghost" disabled>
          Choose from library
        </button>
      </div>

      <p className="status-text muted">Connect your wallet above to enable reporting.</p>
    </div>
  );
}
