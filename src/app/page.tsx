import { en } from '@/i18n/en';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="page-shell">
      <aside className="preview-notice" aria-label="Development status">
        <strong>{en.preview}</strong>
        <p>{en.previewDescription}</p>
      </aside>
      <section className="hero">
        <p className="eyebrow">{en.courseLabel}</p>
        <h1>{en.heading}</h1>
        <p className="lead">{en.description}</p>
        <nav className="actions" aria-label="Account">
          <Link className="button primary" href="/register">
            {en.register}
          </Link>
          <Link className="button" href="/login">
            {en.login}
          </Link>
          <Link href="/dashboard">{en.dashboard}</Link>
        </nav>
      </section>
      <dl className="course-facts" aria-label="Curriculum overview">
        {[
          ['6', 'Phases'],
          ['26', 'Weeks'],
          ['182', 'Days'],
        ].map(([value, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2>{en.approachTitle}</h2>
          <p>{en.approachDescription}</p>
        </section>
        <section className="card">
          <h2>{en.localTitle}</h2>
          <p>{en.localDescription}</p>
        </section>
      </div>
    </div>
  );
}
