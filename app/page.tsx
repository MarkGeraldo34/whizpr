'use client';

import { useState } from 'react';
import { ConnectWallet } from '@/components/ConnectWallet';
import { DepositPanel } from '@/components/DepositPanel';
import { ReportForm } from '@/components/ReportForm';
import { AboutExplainer } from '@/components/AboutExplainer';

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);

  return (
    <main>
      <div className="page-header">
        <div className="brand-row">
          <span className="brand-mark">
            <svg width="38" height="38" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" fill="#E42313" />
              <rect x="28.65" y="29.65" width="46.7" height="46.7" rx="6" transform="rotate(45 52 53)" fill="#7A1B16" />
              <rect x="26.65" y="26.65" width="46.7" height="46.7" rx="6" transform="rotate(45 50 50)" fill="#F4EEDD" />
              <polygon points="50,22 22,48 78,48" fill="#111111" />
              <polygon points="50,78 22,52 78,52" fill="#F1841F" />
            </svg>
          </span>
          <h1>Whizpr</h1>
        </div>
        <ConnectWallet onAuthenticated={setAddress} onDisconnected={() => setAddress(null)} />
      </div>
      <p className="muted" style={{ marginBottom: 24 }}>
        Real-time public safety alerts, backed by a prepaid on-chain WOKB balance.
      </p>

      {!address && <AboutExplainer />}

      {address && (
        <>
          <DepositPanel />
          <ReportForm />
        </>
      )}
    </main>
  );
}
