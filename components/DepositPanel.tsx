'use client';

import { useState, useEffect, useCallback } from 'react';

const DEPOSIT_ADDRESS = process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS ?? '';
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? '';

export function DepositPanel() {
  const [balance, setBalance] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error' | 'ok'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshBalance = useCallback(async () => {
    const res = await fetch('/api/ledger/balance');
    if (res.ok) {
      const data = await res.json();
      setBalance(data.balance);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  async function copyAddress() {
    if (!DEPOSIT_ADDRESS) return;
    try {
      await navigator.clipboard.writeText(DEPOSIT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can still select the text manually.
    }
  }

  async function submitDeposit() {
    if (!txHash) return;
    setStatus('verifying');
    setMessage(null);
    try {
      const res = await fetch('/api/deposit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();

      if (res.status === 202) {
        setStatus('idle');
        setMessage(data.reason ?? 'Deposit not yet confirmed — try again shortly.');
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Verification failed');
      }

      setStatus('ok');
      setBalance(data.balance);
      setTxHash('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 7v10M9.5 9.5c0-1.1 1.12-2 2.5-2s2.5.9 2.5 2c0 2.5-5 1.5-5 4 0 1.1 1.12 2 2.5 2s2.5-.9 2.5-2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Prepaid balance
      </div>
      <div className="balance-display">{balance !== null ? `${balance} wei` : '—'}</div>

      <label>Deposit address {CHAIN_ID && `(chain ${CHAIN_ID})`}</label>
      {DEPOSIT_ADDRESS ? (
        <>
          <div className="address-box">
            <code>{DEPOSIT_ADDRESS}</code>
            <button className="ghost" onClick={copyAddress} style={{ flexShrink: 0 }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 14 }}>
            Send USDT to this address, then paste the transaction hash below to credit your
            prepaid balance.
          </p>
        </>
      ) : (
        <p className="status-text error" style={{ marginBottom: 14 }}>
          Deposit address is not configured (NEXT_PUBLIC_DEPOSIT_ADDRESS is missing).
        </p>
      )}

      <label htmlFor="txHash">Deposit transaction hash</label>
      <input
        id="txHash"
        placeholder="0x..."
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
      />
      <button onClick={submitDeposit} disabled={status === 'verifying' || !txHash}>
        {status === 'verifying' ? 'Verifying on-chain...' : 'Verify deposit'}
      </button>
      {message && <p className="status-text muted">{message}</p>}
    </div>
  );
}
