'use client';

import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { useEffect, useState } from 'react';
import { SiweMessage } from 'siwe';

export function ConnectWallet({
  onAuthenticated,
}: {
  onAuthenticated: (address: string) => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<'idle' | 'signing' | 'authed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setStatus('authed');
          onAuthenticated(data.address);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn() {
    if (!address || !chainId) return;
    setStatus('signing');
    setError(null);
    try {
      const nonceRes = await fetch('/api/auth/nonce');
      const { nonce } = await nonceRes.json();

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Whizpr to verify your wallet.',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      }).prepareMessage();

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const { error: msg } = await verifyRes.json();
        throw new Error(msg ?? 'Sign-in failed');
      }

      setStatus('authed');
      onAuthenticated(address);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }

  if (!isConnected) {
    return (
      <div className="card">
        <p className="muted">Connect a wallet to get started.</p>
        <div className="row">
          {connectors.map((connector) => (
            <button key={connector.uid} onClick={() => connect({ connector })}>
              Connect {connector.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'authed') {
    return (
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">
          Signed in as {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="muted">
        Wallet connected as {address?.slice(0, 6)}...{address?.slice(-4)}. Sign a message to verify
        ownership (no gas required).
      </p>
      <button onClick={signIn} disabled={status === 'signing'}>
        {status === 'signing' ? 'Waiting for signature...' : 'Sign in with Ethereum'}
      </button>
      {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
    </div>
  );
}
