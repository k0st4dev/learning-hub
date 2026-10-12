import Link from 'next/link';
import { en } from '@/i18n/en';
import type { HandbookGuidanceModel } from '@/server/content/handbook-guidance';

export function HandbookGuidance({
  kind,
  links,
  branches,
  unavailable,
}: HandbookGuidanceModel) {
  return (
    <nav
      className="card mb-8 stack"
      aria-label={
        kind === 'branches' ? en.handbook.branches : en.handbook.relatedGuidance
      }
      data-handbook-guidance={kind}
    >
      <h2>
        {kind === 'branches'
          ? en.handbook.branches
          : en.handbook.relatedGuidance}
      </h2>
      <p>
        {kind === 'branches'
          ? en.handbook.branchNotice
          : en.handbook.aiGuidanceNotice}
      </p>
      {(links.length > 0 || branches.length > 0) && (
        <ul className="curriculum-links">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} prefetch={false} lang="sr-Latn">
                {link.title}
              </Link>
            </li>
          ))}
          {branches.map((branch) => (
            <li key={branch.sourceId}>
              <a href={'#' + encodeURIComponent(branch.anchor)} lang="sr-Latn">
                {branch.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {unavailable && <p>{en.handbook.guidanceUnavailable}</p>}
    </nav>
  );
}
