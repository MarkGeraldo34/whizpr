'use client';

import { useState, useEffect, useCallback } from 'react';

export function DepositPanel() {
  const [balance, setBalance] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error' | 'ok'>('idle');
  const [message, setMessage] = useState<string | null>(null);

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
