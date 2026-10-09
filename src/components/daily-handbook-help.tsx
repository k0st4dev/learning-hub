import Link from 'next/link';
import { en } from '@/i18n/en';
import type { DailyHandbook } from '@/server/content/daily-handbook';

export function DailyHandbookHelp({ links, unavailable }: DailyHandbook) {
  return (
    <details className="card mb-8" data-daily-handbook-help>
      <summary>{en.daily.handbookHelp}</summary>
      <div className="stack">
        <p>{en.daily.handbookNotice}</p>
        {links.length > 0 && (
          <nav aria-label={en.daily.handbookLinks}>
            <ul className="curriculum-links">
              {links.map((link) => (
                <li key={link.key}>
                  <Link href={link.href} prefetch={false} lang="sr-Latn">
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {unavailable && <p>{en.daily.handbookUnavailable}</p>}
      </div>
    </details>
  );
}
