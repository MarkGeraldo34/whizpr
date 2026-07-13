'use client';

import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  function handleConnectClick() {
    if (connectors.length === 1) {
      connect({ connector: connectors[0] });
      return;
    }
    setMenuOpen((open) => !open);
  }

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
      <div className={`card${menuOpen ? ' card-elevated' : ''}`}>
        <div className="card-title">
          <span className="icon-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17" cy="14.5" r="1.4" fill="currentColor" />
            </svg>
          </span>
          Connect your wallet
        </div>
        <p className="muted" style={{ marginBottom: 16 }}>
          Connect a wallet to get started.
        </p>
        <div className="connector-menu-anchor" ref={menuRef}>
          <button onClick={handleConnectClick} disabled={connectors.length === 0}>
            Connect Wallet
          </button>
          {menuOpen && connectors.length > 1 && (
            <div className="connector-menu">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  className="connector-option"
                  onClick={() => {
                    connect({ connector });
                    setMenuOpen(false);
                  }}
                >
                  {connector.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'authed') {
    return (
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <span className="wallet-pill">
          <span className="wallet-dot" />
          Signed in as {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button className="ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path d="M19 11v1a7 7 0 0 1-14 0v-1M12 19v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        Verify ownership
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Wallet connected as {address?.slice(0, 6)}...{address?.slice(-4)}. Sign a message to verify
        ownership (no gas required).
      </p>
      <button onClick={signIn} disabled={status === 'signing'}>
        {status === 'signing' ? 'Waiting for signature...' : 'Sign in with Ethereum'}
      </button>
      {error && <p className="status-text error">{error}</p>}
    </div>
  );
}
