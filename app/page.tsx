'use client';

import { useState } from 'react';
import { ConnectWallet } from '@/components/ConnectWallet';
import { DepositPanel } from '@/components/DepositPanel';
import { ReportForm } from '@/components/ReportForm';

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Whizpr</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
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
