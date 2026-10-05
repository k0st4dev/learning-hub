import { notFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import type { Catalog } from '@/server/content/read';
import { catalogPage } from '@/server/content/read';
import { CurriculumPreview } from './curriculum-preview';
import { en } from '@/i18n/en';
export function FullCurriculumPage({
  catalog,
  route,
  exerciseEditor,
  studyEditor,
  progressView,
}: {
  catalog: Catalog;
  route: string;
  exerciseEditor?: React.ReactNode;
  studyEditor?: React.ReactNode;
  progressView?: React.ReactNode;
}) {
  if (route.startsWith('/resources/')) {
    const resource = catalog.resources.find(
      (r) => `/resources/${r.stableKey}` === route,
    );
    if (!resource) notFound();
    const uses = catalog.uses.filter((u) => u.resourceId === resource.id);
    return (
      <>
        <Link href="/resources">{en.curriculum.references}</Link>
        <h1>{resource.title}</h1>
        <p className="source" lang="sr-Latn">
          {resource.descriptionMarkdown}
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
            {resource.originalUrl} {en.curriculum.newTab}
          </a>
        )}
        <h2 className="section">{en.curriculum.contexts}</h2>
        <ul className="curriculum-links">
          {uses.map((use) => {
            const item = catalog.items.find(
              (item) => item.id === use.contentItemId,
            )!;
            return (
              <li key={use.id}>
                <Link href={item.route}>
                  <span lang="sr-Latn">{item.title}</span>
                </Link>
                <p lang="sr-Latn" className="source">
                  {use.assignedText}
                </p>
              </li>
            );
          })}
        </ul>
      </>
    );
  }
  const page = catalogPage(catalog, route);
  if (!page) notFound();
  return (
    <>
      <CurriculumPreview
        catalog={catalog}
        page={page}
        exerciseEditor={exerciseEditor}
        studyEditor={studyEditor}
        progressView={progressView}
      />
      {route === '/progress/scorecard' && (
        <section className="section">
          <h2>{en.curriculum.scorecard}</h2>
          <ol>
            {z
              .object({
                scorecard: z.object({ dimensions: z.array(z.string()) }),
              })
              .parse(JSON.parse(page.item.metadataJson))
              .scorecard.dimensions.map((d) => (
                <li key={d}>{d}</li>
              ))}
          </ol>
        </section>
      )}
    </>
  );
}
