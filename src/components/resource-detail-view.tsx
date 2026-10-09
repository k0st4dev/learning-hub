import { resourceDetailViewSchema } from '@/domain/resource-library-view';
import { AppError } from '@/server/errors';
import { ResourceLibraryCard } from './resource-library-card';

export function ResourceDetailView({
  data,
  releaseId,
}: {
  data: unknown;
  releaseId: string;
}) {
  const detail = resourceDetailViewSchema.parse(data);
  if (detail.releaseId !== releaseId)
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'Resource labels belong to another course version.',
    );
  return (
    <section className="section stack" aria-labelledby="resource-detail-labels">
      <h2 id="resource-detail-labels">Resource labels and source evidence</h2>
      <p>
        Type and provider labels are explained separately from the original
        manual. Assignment labels depend on the exact lesson and add no course
        credit. Open the assignments below to see each label and its source
        evidence. Reviewed connections are shown separately; the original
        imported contexts remain available on original resource pages. Named
        references are added interpretations with full original instructions.
      </p>
      <ResourceLibraryCard resource={detail.resource} detail />
    </section>
  );
}
