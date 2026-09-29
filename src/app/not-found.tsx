import Link from 'next/link';
import { en } from '@/i18n/en';
export default function NotFound() {
  return (
    <div className="page-shell">
      <h1>{en.notFound}</h1>
      <p>{en.notFoundDescription}</p>
      <Link className="button" href="/">
        {en.home}
      </Link>
    </div>
  );
}
