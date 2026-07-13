import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Whizpr — Real-time public safety alerts',
  description:
    'Upload emergency media to alert nearby responders in real time, backed by an on-chain prepaid WOKB ledger.',
};

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22 5.9c-.7.3-1.5.5-2.3.6.8-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1-.8-.8-1.9-1.3-3.1-1.3-2.3 0-4.2 1.9-4.2 4.2 0 .3 0 .6.1.9-3.5-.2-6.6-1.9-8.7-4.4-.4.6-.6 1.3-.6 2.1 0 1.4.7 2.7 1.8 3.4-.7 0-1.3-.2-1.9-.5v.1c0 2 1.4 3.7 3.3 4.1-.3.1-.7.1-1.1.1-.3 0-.5 0-.8-.1.5 1.7 2.1 2.9 3.9 2.9-1.4 1.1-3.2 1.8-5.2 1.8-.3 0-.7 0-1-.1 1.9 1.2 4.1 1.9 6.4 1.9 7.7 0 11.9-6.4 11.9-11.9v-.5c.8-.6 1.5-1.3 2.1-2.2Z"
        fill="#1DA1F2"
      />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#fff" />
      <path d="M2 6c0-1 1-1.5 2-1h16c1 0 2 .5 2 1l-10 7L2 6Z" fill="#EA4335" />
      <path d="M2 6l7 4.8L2 17.5V6Z" fill="#4285F4" />
      <path d="M22 6l-7 4.8 7 6.7V6Z" fill="#34A853" />
      <path d="M2 17.2 9.6 11.4 12 13l2.4-1.6L22 17.2c-.3.5-1 .8-2 .8H4c-1 0-1.7-.3-2-.8Z" fill="#FBBC04" />
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
              aria-label="Developer on Twitter: @gerald_Chzu"
              title="@gerald_Chzu"
            >
              <TwitterIcon />
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
      </body>
    </html>
  );
}
