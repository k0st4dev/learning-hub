import type { Metadata } from 'next';
import Link from 'next/link';
import { en } from '@/i18n/en';
import { HistoryProtection } from '@/components/history-protection';
import './globals.css';

export const metadata: Metadata = {
  title: en.appName,
  description: en.description,
};
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <HistoryProtection />
        <a className="skip-link" href="#main">
          {en.skip}
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">
              {en.appName}
            </Link>
            <Link href="/search" prefetch={false}>
              Search
            </Link>
            <span className="local-label">Local learning</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          Study at your own pace. Code in your local IDE.
        </footer>
      </body>
    </html>
  );
}
