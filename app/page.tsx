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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9" r="2.4" fill="#fff" />
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
