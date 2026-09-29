import Link from 'next/link';
import { Logout } from './logout';
import { en } from '@/i18n/en';
export function StudentShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell">
      <nav className="actions mb-8" aria-label="Student">
        <Link href="/dashboard">{en.dashboard}</Link>
        <Link href="/course/software-engineer">{en.courseLabel}</Link>
        <span className="muted">{name}</span>
        <Logout />
      </nav>
      <aside className="preview-notice mb-8">
        <strong>{en.preview}</strong>
        <p>{en.previewDescription}</p>
      </aside>
      {children}
    </div>
  );
}
