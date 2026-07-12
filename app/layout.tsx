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
      </body>
    </html>
  );
}
