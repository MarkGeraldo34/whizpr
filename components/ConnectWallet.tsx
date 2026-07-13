'use client';

import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import type { Connector } from 'wagmi';
import { useEffect, useRef, useState } from 'react';
import { SiweMessage } from 'siwe';

function BrandIcon({ brand }: { brand: string }) {
  if (brand.includes('walletconnect')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M7 9.8c2.8-2.7 7.2-2.7 10 0l.4.4a.5.5 0 0 1 0 .7l-1.3 1.3a.3.3 0 0 1-.4 0l-.6-.5c-1.9-1.9-5-1.9-6.9 0l-.6.6a.3.3 0 0 1-.4 0L5.8 11a.5.5 0 0 1 0-.7Zm12.4 2.3 1.2 1.2a.5.5 0 0 1 0 .7l-5.2 5.2a.5.5 0 0 1-.7 0l-3.7-3.7a.15.15 0 0 0-.2 0l-3.7 3.7a.5.5 0 0 1-.7 0L1.4 14a.5.5 0 0 1 0-.7l1.2-1.2a.5.5 0 0 1 .7 0l3.7 3.7c.1.1.2.1.2 0l3.7-3.7a.5.5 0 0 1 .7 0l3.7 3.7c.1.1.2.1.2 0l3.7-3.7a.5.5 0 0 1 .7 0Z"
          fill="#3396FF"
        />
      </svg>
    );
  }

  if (brand.includes('coinbase')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#0052FF" />
        <rect x="8.5" y="8.5" width="7" height="7" rx="1.8" fill="#fff" />
      </svg>
    );
  }

  if (brand.includes('metamask')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#F6851B" />
        <path
          d="M6 16 9 8l3 5 3-5 3 8"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  if (brand.includes('trust')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z" fill="#3375BB" />
        <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="6" width="20" height="14" rx="3" fill="#F1841F" />
      <path d="M2 10h20" stroke="#161d29" strokeWidth="1.6" />
      <circle cx="17" cy="14.5" r="1.4" fill="#161d29" />
    </svg>
  );
}

function ConnectorIcon({ connector }: { connector: Connector }) {
  if (connector.icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={connector.icon} alt="" />;
  }
  return <BrandIcon brand={connector.id.toLowerCase()} />;
}

const MOBILE_WALLET_APPS = [
  { name: 'MetaMask', brand: 'metamask', link: (url: string) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}` },
  { name: 'Trust Wallet', brand: 'trust', link: (url: string) => `https://link.trustwallet.com/open_url?url=${encodeURIComponent(url)}` },
  { name: 'Coinbase Wallet', brand: 'coinbase', link: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
];

function isMobileWithoutInjectedProvider() {
  if (typeof window === 'undefined') return false;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasInjectedProvider = typeof (window as unknown as { ethereum?: unknown }).ethereum !== 'undefined';
  return isMobile && !hasInjectedProvider;
}

export function ConnectWallet({
  onAuthenticated,
  onDisconnected,
}: {
  onAuthenticated: (address: string) => void;
  onDisconnected?: () => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<'idle' | 'signing' | 'authed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileFallback, setMobileFallback] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileFallback(isMobileWithoutInjectedProvider());
  }, []);

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

  function handleDisconnectClick() {
    disconnect();
    setStatus('idle');
    onDisconnected?.();
  }

  function handleConnectClick() {
    if (mobileFallback || connectors.length > 1) {
      setMenuOpen((open) => !open);
      return;
    }
    if (connectors.length === 1) {
      connect({ connector: connectors[0] });
    }
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
      <div className="wallet-widget">
        <div className="connector-menu-anchor" ref={menuRef}>
          <button onClick={handleConnectClick} disabled={connectors.length === 0}>
            Connect Wallet
          </button>
          {menuOpen && mobileFallback && (
            <div className="connector-menu">
              <p className="connector-menu-hint">No wallet detected. Open Whizpr in a wallet app:</p>
              {MOBILE_WALLET_APPS.map((app) => (
                <a
                  key={app.brand}
                  className="connector-option"
                  href={app.link(window.location.href)}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="connector-option-icon">
                    <BrandIcon brand={app.brand} />
                  </span>
                  {app.name}
                </a>
              ))}
            </div>
          )}
          {menuOpen && !mobileFallback && connectors.length > 1 && (
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
                  <span className="connector-option-icon">
                    <ConnectorIcon connector={connector} />
                  </span>
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
      <div className="wallet-widget">
        <span className="wallet-pill">
          <span className="wallet-dot" />
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button className="ghost" onClick={handleDisconnectClick}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-widget">
      <span className="wallet-pill">
        <span className="wallet-dot" />
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      <button onClick={signIn} disabled={status === 'signing'}>
        {status === 'signing' ? 'Waiting for signature...' : 'Sign in with Ethereum'}
      </button>
      {error && <p className="status-text error">{error}</p>}
    </div>
  );
}
