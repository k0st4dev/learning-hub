'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export function TopUtilityBar() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        router.push('/search');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  let sectionTitle = 'Pregled';
  if (pathname.startsWith('/dashboard')) sectionTitle = 'Dashboard';
  else if (pathname.startsWith('/course/software-engineer/progress'))
    sectionTitle = 'Pregled napretka';
  else if (pathname.startsWith('/course/software-engineer/days'))
    sectionTitle = 'Dnevni radni prostor';
  else if (pathname.startsWith('/course/software-engineer'))
    sectionTitle = 'Nastavni plan i program';
  else if (pathname.startsWith('/resources')) sectionTitle = 'Biblioteka resursa';
  else if (pathname.startsWith('/search')) sectionTitle = 'Pretraga kurikuluma';
  else if (pathname.startsWith('/settings')) sectionTitle = 'Podešavanja';
  else if (pathname.startsWith('/progress/scorecard'))
    sectionTitle = 'Mesečni scorecard';

  return (
    <div className="top-utility-bar mb-6">
      <div className="top-utility-breadcrumbs">
        <span className="breadcrumb-root">Program učenja</span>
        <span className="breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="breadcrumb-current">{sectionTitle}</span>
      </div>
      <div className="top-utility-actions">
        <Link
          href="/search"
          prefetch={false}
          className="top-search-trigger"
          aria-label="Pretraga kurikuluma (Ctrl+K)"
        >
          <span aria-hidden="true">🔍</span>
          <span className="search-text">Pretraga...</span>
          <kbd className="shortcut-key">Ctrl K</kbd>
        </Link>
        <div className="top-sync-pill" title="Lokalna SQLite baza podataka">
          <span className="status-dot" aria-hidden="true"></span>
          <span>Lokalno</span>
        </div>
      </div>
    </div>
  );
}
