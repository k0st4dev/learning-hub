import Link from 'next/link';
import type {
  NavigationItem,
  NavigationTarget,
  PageNavigation,
} from '@/server/content/navigation';
import { en } from '@/i18n/en';

// A pure renderer keeps the large outline from creating hundreds of RSC component boundaries.
export function curriculumItemLabel(item: NavigationItem) {
  return (
    <>
      {item.kind === 'week' && `${en.navigation.week} ${item.weekNumber} — `}
      {item.dayNumber !== null && `${en.navigation.day} ${item.dayNumber} — `}
      {item.kind === 'lesson' && `${en.learning.study}: `}
      {item.kind === 'exercise' && `${en.learning.practice}: `}
      <span lang="sr-Latn">{item.title}</span>
    </>
  );
}
function Destination({
  target,
  direction,
}: {
  target: NavigationTarget;
  direction: 'previous' | 'next';
}) {
  return (
    <Link
      className="card sequence-link"
      href={target.href}
      rel={direction === 'previous' ? 'prev' : 'next'}
    >
      {target.kind === 'content' ? (
        <>
          <strong>{en.navigation[direction]}</strong>
          <span>{curriculumItemLabel(target.item)}</span>
        </>
      ) : (
        <strong>
          {target.kind === 'preparation'
            ? en.navigation.backPreparation
            : en.navigation.reviewProgress}
        </strong>
      )}
    </Link>
  );
}
export function CurriculumNavigation({
  navigation,
}: {
  navigation: PageNavigation;
}) {
  if (!navigation.mode) return null;
  return (
    <nav
      className="section"
      aria-label={
        navigation.mode === 'day' ? en.navigation.days : en.navigation.units
      }
    >
      <h2>
        {navigation.mode === 'day' ? en.navigation.days : en.navigation.units}
      </h2>
      <p className="muted">{en.navigation.help}</p>
      <div className="sequence-links">
        {navigation.previous ? (
          <Destination target={navigation.previous} direction="previous" />
        ) : (
          <span className="card muted" aria-disabled="true">
            {en.navigation.firstDay}
          </span>
        )}
        {navigation.next ? (
          <Destination target={navigation.next} direction="next" />
        ) : (
          <span className="card muted" aria-disabled="true">
            {en.navigation.lastDay}
          </span>
        )}
      </div>
    </nav>
  );
}
