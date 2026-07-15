'use client';

import { useState } from 'react';
import { ConnectWallet } from '@/components/ConnectWallet';
import { DepositPanel } from '@/components/DepositPanel';
import { ReportForm } from '@/components/ReportForm';
import { ReportFormPreview } from '@/components/ReportFormPreview';
import { AboutExplainer } from '@/components/AboutExplainer';
import { CountryLeaderboard } from '@/components/CountryLeaderboard';
import { ProfileTab } from '@/components/ProfileTab';
import { NavTabs, type TabKey } from '@/components/NavTabs';

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('report');

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
        <ConnectWallet
          onAuthenticated={setAddress}
          onDisconnected={() => {
            setAddress(null);
            setTab('report');
          }}
        />
      </div>

      <NavTabs active={tab} onChange={setTab} />

      <p className="muted" style={{ marginBottom: 24 }}>
        Real-time public safety alerts, backed by a prepaid on-chain USDT balance.
      </p>

      {tab === 'leaderboard' && <CountryLeaderboard />}

      {tab === 'report' && !address && (
        <>
          <ReportFormPreview />
          <AboutExplainer />
        </>
      )}

      {tab === 'report' && address && (
        <>
          <DepositPanel />
          <ReportForm />
        </>
      )}

      {tab === 'profile' &&
        (address ? (
          <ProfileTab />
        ) : (
          <div className="card">
            <div className="card-title">
              <span className="icon-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M4.5 20c1.4-3.6 4.5-5.5 7.5-5.5s6.1 1.9 7.5 5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Profile
            </div>
            <p className="muted">Connect your wallet above to view your Whizcredits balance and username.</p>
          </div>
        ))}
    </main>
  );
}
