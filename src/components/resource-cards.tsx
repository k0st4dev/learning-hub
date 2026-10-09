import Link from 'next/link';
import type { Catalog } from '@/server/content/read';
import { en } from '@/i18n/en';
import { resourceBindingPresentation } from '@/server/content/resource-bindings';
import { resourceBindingViewSchema } from '@/domain/resource-binding-view';
import { AppError } from '@/server/errors';
import { ResourceConnection } from './resource-connection';
import { resourceMentionPresentation } from '@/server/content/resource-mentions';
import { presentNamedMention } from '@/server/content/resource-mention-view';
import { ResourceNamedMention } from './resource-named-mention';
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
  let named: ReturnType<typeof resourceMentionPresentation> | undefined;
  try {
    bindings = resourceBindingPresentation(catalog);
    named = resourceMentionPresentation(catalog);
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 503) throw error;
  }
  const contexts = new Set(uses.map((row) => row.contentItemId));
  const mentions =
    named?.mentions.filter((row) => contexts.has(row.contentItemId)) ?? [];
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
          {bindings && !named && (
            <div className="notice" role="alert">
              <p>
                Named resource interpretations are unavailable. Original
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
                Retry named resources
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
          {mentions.map((mention) => {
            const resource = named!.resources.find(
              (row) => row.id === mention.resourceId,
            )!;
            return (
              <article
                className="card mb-4 stack"
                key={mention.key}
                data-learning-resource-mention={mention.key}
              >
                <h3>
                  <Link
                    prefetch={false}
                    href={'/resources/' + resource.stableKey}
                  >
                    {resource.title}
                  </Link>
                </h3>
                <ResourceNamedMention
                  mention={presentNamedMention(catalog, mention)}
                />
                {resource.action === 'derived-resource' && (
                  <p>No direct link supplied in the manual.</p>
                )}
                {resource.parent &&
                  resource.parent.resourceId !== resource.id && (
                    <div className="stack">
                      <Link
                        prefetch={false}
                        href={
                          '/resources/' +
                          catalog.resources.find(
                            (row) => row.id === resource.parent!.resourceId,
                          )!.stableKey
                        }
                      >
                        Parent resource:{' '}
                        {
                          catalog.resources.find(
                            (row) => row.id === resource.parent!.resourceId,
                          )!.title
                        }
                      </Link>
                      <a
                        href={resource.parent.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open parent resource (new tab)
                      </a>
                    </div>
                  )}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
