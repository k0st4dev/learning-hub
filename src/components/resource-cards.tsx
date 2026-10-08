import Link from 'next/link';
import type { Catalog } from '@/server/content/read';
import { en } from '@/i18n/en';
import { resourceBindingPresentation } from '@/server/content/resource-bindings';
import { resourceBindingViewSchema } from '@/domain/resource-binding-view';
import { AppError } from '@/server/errors';
import { ResourceConnection } from './resource-connection';
export function ResourceCards({
  catalog,
  uses,
  retryHref,
}: {
  catalog: Catalog;
  uses: Catalog['uses'];
  retryHref?: string;
}) {
  if (!uses.length) return null;
  let bindings: ReturnType<typeof resourceBindingPresentation> | undefined;
  try {
    bindings = resourceBindingPresentation(catalog);
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 503) throw error;
  }
  return (
    <>
      {uses.length > 0 && (
        <section className="section">
          <h2>{en.curriculum.references}</h2>
          {!bindings && (
            <div className="notice" role="alert">
              <p>
                Reviewed resource connections are unavailable. Original
                instructions and links remain below.
              </p>
              <a
                href={
                  retryHref ??
                  catalog.items.find(
                    (item) => item.id === uses[0]!.contentItemId,
                  )!.route
                }
              >
                Retry resource connections
              </a>
            </div>
          )}
          {uses.map((use) => {
            const binding = bindings?.uses.get(use.id);
            const resource = catalog.resources.find(
              (r) => r.id === (binding?.effectiveResourceId ?? use.resourceId),
            )!;
            return (
              <article
                className="card mb-4"
                key={use.id}
                data-learning-resource-use={use.id}
              >
                <h3>
                  <Link href={`/resources/${resource.stableKey}`}>
                    {resource.title}
                  </Link>
                </h3>
                <p className="source" lang="sr-Latn">
                  {use.assignedText}
                </p>
                {binding && (
                  <ResourceConnection
                    binding={resourceBindingViewSchema.parse(binding)}
                  />
                )}
                <p>
                  {resource.originalUrl
                    ? en.curriculum.parentLink
                    : en.curriculum.noUrl}
                </p>
                {resource.originalUrl && (
                  <a
                    href={resource.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {resource.title} {en.curriculum.newTab}
                  </a>
                )}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
