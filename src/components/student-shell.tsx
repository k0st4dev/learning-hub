import Link from 'next/link';
import { Logout } from './logout';
import { en } from '@/i18n/en';
export function StudentShell({
  name,
  children,
  showFixtureNotice = true,
}: {
  name: string;
  children: React.ReactNode;
  showFixtureNotice?: boolean;
}) {
  return (
    <div className="page-shell">
      <nav className="actions mb-8" aria-label="Student">
        <Link href="/dashboard">{en.dashboard}</Link>
        <Link href="/course/software-engineer">{en.courseLabel}</Link>
        <span className="muted">{name}</span>
        <Logout />
      </nav>
      {showFixtureNotice && (
        <aside className="preview-notice mb-8">
          <strong>{en.preview}</strong>
          <p>{en.previewDescription}</p>
        </aside>
      )}
      {children}
    </div>
  );
}
