import Link from 'next/link';
import type { Catalog } from '@/server/content/read';
import { en } from '@/i18n/en';
export function ResourceCards({
  catalog,
  uses,
}: {
  catalog: Catalog;
  uses: Catalog['uses'];
}) {
  return (
    <>
      {uses.length > 0 && (
        <section className="section">
          <h2>{en.curriculum.references}</h2>
          {uses.map((use) => {
            const resource = catalog.resources.find(
              (r) => r.id === use.resourceId,
            )!;
            return (
              <article className="card mb-4" key={use.id}>
                <h3>
                  <Link href={`/resources/${resource.stableKey}`}>
                    {resource.title}
                  </Link>
                </h3>
                <p className="source" lang="sr-Latn">
                  {use.assignedText}
                </p>
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
