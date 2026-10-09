import Link from 'next/link';
import type { ResourceMentionView } from '@/domain/resource-mention-view';
import { resourceRequirementLabels } from '@/domain/resource-library-view';

export function ResourceNamedMention({
  mention,
  matching = false,
}: {
  mention: ResourceMentionView;
  matching?: boolean;
}) {
  return (
    <details data-resource-mention={mention.key}>
      <summary>
        {mention.displayName} ·{' '}
        {resourceRequirementLabels[mention.requirementMode]}
        {matching ? ' · Matches current filters' : ''}
      </summary>
      <p>
        Added resource interpretation; this reference adds no course credit.
      </p>
      <Link prefetch={false} href={mention.sourceMappingHref}>
        <span lang="sr-Latn">
          {mention.dayNumber ? 'Day ' + mention.dayNumber + ' — ' : ''}
          {mention.title}
        </span>{' '}
        · Original source context
      </Link>
      <p className="source" lang="sr-Latn">
        {mention.exactInstruction}
      </p>
      {mention.choiceGroup && (
        <p>Choose one alternative in this assignment; do not require both.</p>
      )}
      {mention.scope.day === null && (
        <p>
          Weekly reference; this is not an assignment to every day of the week.
        </p>
      )}
      <p>{mention.reason}</p>
      <details>
        <summary>Original associations and source evidence</summary>
        <ul>
          {mention.originReferences.map((row) => (
            <li key={row.useId} data-mention-origin={row.useId}>
              <Link prefetch={false} href={row.href}>
                {row.title}
              </Link>
            </li>
          ))}
        </ul>
        {mention.evidence.map((row) => (
          <blockquote key={row.sourceId}>
            <span>
              {row.sourceId}
              {row.table === null
                ? ''
                : ` · Table ${row.table}, row ${row.row}, cell ${row.cell}`}
            </span>
            <p lang="sr-Latn">{row.exactText}</p>
          </blockquote>
        ))}
      </details>
    </details>
  );
}
