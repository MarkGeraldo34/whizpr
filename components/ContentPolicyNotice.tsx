import { MAX_VIDEO_SECONDS } from '@/lib/content-policy';

// Shown to every visitor, connected or not, so the reporting rules and
// consequences for violating them are never a surprise.
export function ContentPolicyNotice() {
  return (
    <div className="card">
      <div className="card-title alert-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 3 4 6.5V11c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6.5L12 3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Reporting guidelines
      </div>

      <p className="muted" style={{ marginBottom: 8 }}>
        Whizpr is for real emergencies only — a photo or video of an actual fire, accident, crime,
        or other hazardous incident as it&rsquo;s happening.
      </p>

      <ul style={{ margin: '0 0 10px', paddingLeft: 18, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.65 }}>
        <li>No nudity, selfies, or content unrelated to a genuine hazard.</li>
        <li>Videos must be {MAX_VIDEO_SECONDS} seconds or shorter.</li>
      </ul>

      <p className="status-text error" style={{ marginTop: 0, marginBottom: 0 }}>
        Reports are reviewed. Violations may result in Whizcredits being removed or your account
        being banned from submitting further reports.
      </p>
    </div>
  );
}
