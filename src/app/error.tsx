'use client';
import { en } from '@/i18n/en';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell">
      <h1>{en.unavailableTitle}</h1>
      <p>{en.unavailableDescription}</p>
      <button className="button" onClick={reset}>
        {en.retry}
      </button>
    </div>
  );
}
