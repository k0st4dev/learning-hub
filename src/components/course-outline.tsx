import type { OutlineBranch } from '@/server/content/navigation';
import Link from 'next/link';
import { curriculumItemLabel } from './curriculum-navigation';
import { en } from '@/i18n/en';

function entry(branch: OutlineBranch) {
  const label = curriculumItemLabel(branch.item);
  return branch.current ? (
    <span className="outline-current" aria-current="page">
      {label}
      <small>{en.navigation.currentPage}</small>
    </span>
  ) : (
    <a href={branch.item.route}>{label}</a>
  );
}
function branchesList(branches: OutlineBranch[]) {
  return (
    <ol>
      {branches.map((branch) => (
        <li key={branch.item.id}>
          {branch.children.length ? (
            <details open={branch.expanded} data-outline-item={branch.item.id}>
              <summary>
                {branch.item.kind === 'module' &&
                  `${en.navigation.phase} ${branch.item.orderIndex + 1} — `}
                {curriculumItemLabel(branch.item)}
              </summary>
              {entry(branch)}
              {branchesList(branch.children)}
            </details>
          ) : (
            entry(branch)
          )}
        </li>
      ))}
    </ol>
  );
}
export function CourseOutline({
  branches,
  overview,
}: {
  branches: OutlineBranch[];
  overview: boolean;
}) {
  return (
    <nav
      id="course-outline"
      tabIndex={-1}
      className="course-outline"
      aria-label={en.navigation.outline}
    >
      <details open>
        <summary>{en.navigation.outline}</summary>
        <p className="muted">{en.navigation.outlineHelp}</p>
        {overview ? (
          <span className="outline-current" aria-current="page">
            {en.navigation.overview}
            <small>{en.navigation.currentPage}</small>
          </span>
        ) : (
          <Link href="/course/software-engineer" prefetch={false}>
            {en.navigation.overview}
          </Link>
        )}
        {branchesList(branches)}
      </details>
    </nav>
  );
}
