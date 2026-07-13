'use client';

import { useState } from 'react';
import { ConnectWallet } from '@/components/ConnectWallet';
import { DepositPanel } from '@/components/DepositPanel';
import { ReportForm } from '@/components/ReportForm';

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);

  return (
    <main>
      <div className="brand-row">
        <span className="brand-mark">
          <svg width="38" height="38" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="49" fill="#ffffff" stroke="#000000" strokeWidth="0.8" />
            <circle cx="38.4" cy="42.4" r="20.7" fill="#FB4A0A" />
            <ellipse cx="54.6" cy="69.2" rx="31.3" ry="10.6" fill="#0D3B36" />
          </svg>
        </span>
        <h1>Whizpr</h1>
      </div>
      <p className="muted" style={{ marginBottom: 24 }}>
        Real-time public safety alerts, backed by a prepaid on-chain WOKB balance.
      </p>

      <ConnectWallet onAuthenticated={setAddress} />

      {address && (
        <>
          <DepositPanel />
          <ReportForm />
        </>
      )}
    </main>
  );
}
