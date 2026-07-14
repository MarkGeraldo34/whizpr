import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Whizpr — Real-time public safety alerts',
  description:
    'Upload emergency media to alert nearby responders in real time, backed by an on-chain prepaid USDT ledger.',
};

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18.5 4h2.7l-5.9 6.8L22 20h-5.4l-4.3-5.6L7.4 20H4.6l6.3-7.3L3 4h5.5l3.9 5.1L18.5 4Zm-.9 14.4h1.5L7.5 5.5H5.9l11.7 12.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 6.5 12 13l9-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <footer className="site-footer">
          <div className="site-footer-icons">
            <a
              href="https://twitter.com/gerald_Chzu"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Developer on X: @gerald_Chzu"
              title="@gerald_Chzu"
            >
              <XIcon />
            </a>
            <a
              href="mailto:okwunodulugerald@gmail.com"
              aria-label="Email the developer: okwunodulugerald@gmail.com"
              title="okwunodulugerald@gmail.com"
            >
              <GmailIcon />
            </a>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
