import Link from 'next/link';
import type { ResourceBindingView } from '@/domain/resource-binding-view';

export function ResourceConnection({
  binding,
}: {
  binding: ResourceBindingView;
}) {
  if (!binding.changed) return null;
  return (
    <details
      className="resource-connection"
      data-resource-binding={binding.effectiveResourceId}
    >
      <summary>Why this resource is connected</summary>
      <p>
        Added connection based on the original assignment and course context.
      </p>
      <p>
        Original imported resource:{' '}
        <Link prefetch={false} href={binding.originalResource.href}>
          {binding.originalResource.title}
        </Link>
        .
      </p>
      <p>
        Current learning resource:{' '}
        <Link prefetch={false} href={binding.effectiveResource.href}>
          {binding.effectiveResource.title}
        </Link>
        .
      </p>
      <p>
        {binding.interpretation.kind === 'top-foundations-context'
          ? 'This TOP assignment belongs to Foundations weeks 1–6. The JavaScript course covers weeks 7–12.'
          : 'The surrounding weekly material assigns Full Stack Open. This instruction continues that same course.'}
      </p>
      {binding.interpretation.evidence.map((evidence) => (
        <blockquote key={evidence.sourceId}>
          <span>{evidence.sourceId}</span>
          <p lang="sr-Latn">{evidence.exactText}</p>
        </blockquote>
      ))}
    </details>
  );
}
