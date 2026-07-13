import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Whizpr — Real-time public safety alerts',
  description:
    'Upload emergency media to alert nearby responders in real time, backed by an on-chain prepaid WOKB ledger.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <footer className="site-footer">
          <p>
            Developer:{' '}
            <a href="https://twitter.com/gerald_Chzu" target="_blank" rel="noopener noreferrer">
              @gerald_Chzu
            </a>{' '}
            &middot; <a href="mailto:okwunodulugerald@gmail.com">okwunodulugerald@gmail.com</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
