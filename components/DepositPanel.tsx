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
      <label>Prepaid WOKB balance</label>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        {balance !== null ? `${balance} wei` : '—'}
      </div>

      <label>Deposit address {CHAIN_ID && `(chain ${CHAIN_ID})`}</label>
      {DEPOSIT_ADDRESS ? (
        <>
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              background: '#0d1420',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              marginTop: 6,
              marginBottom: 6,
            }}
          >
            <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{DEPOSIT_ADDRESS}</code>
            <button onClick={copyAddress} style={{ flexShrink: 0 }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 14 }}>
            Send WOKB to this address, then paste the transaction hash below to credit your
            prepaid balance.
          </p>
        </>
      ) : (
        <p style={{ color: 'var(--alert)', marginBottom: 14 }}>
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
      {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
