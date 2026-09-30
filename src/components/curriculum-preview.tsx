import Link from 'next/link';
import { z } from 'zod';
import type { Catalog, CatalogPage } from '@/server/content/read';
import { sourceLinkSchema } from '@/server/content/source-schema';
import { en } from '@/i18n/en';
const base = '/course/software-engineer';
function SourceParagraph({ block }: { block: CatalogPage['blocks'][number] }) {
  const links = z.array(sourceLinkSchema).parse(JSON.parse(block.linksJson));
  return (
    <div
      id={block.anchor ?? undefined}
      data-source-id={block.sourceLocator}
      className="source-paragraph"
    >
      <p data-source-text lang="sr-Latn" className="source">
        {block.exactText}
      </p>
      {links.map((link, i) => (
        <p key={i}>
          <a
            data-source-link
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span lang="sr-Latn">{link.label}</span>{' '}
            <span>{en.curriculum.newTab}</span>
          </a>
        </p>
      ))}
      <small className="muted">
        {en.curriculum.sourceRef}: {block.sourceLocator}
      </small>
    </div>
  );
}
export function SourceBlocks({ blocks }: { blocks: CatalogPage['blocks'] }) {
  const parts: React.ReactNode[] = [];
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index]!;
    if (block.tableNumber === null) {
      parts.push(<SourceParagraph key={block.id} block={block} />);
      index++;
      continue;
    }
    const table = block.tableNumber;
    const group: CatalogPage['blocks'] = [];
    while (index < blocks.length && blocks[index]!.tableNumber === table)
      group.push(blocks[index++]!);
    const rows = [...new Set(group.map((b) => b.rowNumber!))].sort(
      (a, b) => a - b,
    );
    parts.push(
      <div
        className="table-scroll"
        key={`table-${table}`}
        tabIndex={0}
        role="region"
        aria-label={`${en.curriculum.sourceTable} ${table}`}
      >
        <table data-source-table={table}>
          <caption>
            {en.curriculum.sourceTable} {table}
          </caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row} data-source-row={row}>
                {[
                  ...new Set(
                    group
                      .filter((b) => b.rowNumber === row)
                      .map((b) => b.cellNumber!),
                  ),
                ]
                  .sort((a, b) => a - b)
                  .map((cell) => (
                    <td key={cell} data-source-cell={cell}>
                      {group
                        .filter(
                          (b) => b.rowNumber === row && b.cellNumber === cell,
                        )
                        .map((b) => (
                          <SourceParagraph key={b.id} block={b} />
                        ))}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }
  return <div className="stack">{parts}</div>;
}
export function CurriculumPreview({
  catalog,
  page,
}: {
  catalog: Catalog;
  page: CatalogPage;
}) {
  const overview = page.item.stableKey === 'overview';
  const roots = catalog.items
    .filter((i) => i.kind === 'module' || i.kind === 'guide')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  let parent = page.item;
  const parents: Catalog['items'] = [];
  while (parent.parentId) {
    const next = catalog.items.find((i) => i.id === parent.parentId);
    if (!next) break;
    parents.unshift(next);
    parent = next;
  }
  const day = catalog.days.find(
    (d) => d.itemId === page.item.id || parents.some((p) => p.id === d.itemId),
  );
  const week = catalog.weeks.find((w) => w.itemId === page.item.id);
  const rule = catalog.rules.find((rule) => rule.itemId === page.item.id);
  return (
    <>
      <aside className="preview-notice mb-8">
        <strong>{en.curriculum.preview}</strong>
        <p>{en.curriculum.previewHelp}</p>
      </aside>
      <nav className="actions mb-8" aria-label={en.curriculum.breadcrumbs}>
        <Link href="/dashboard">{en.dashboard}</Link>
        <Link href={base}>{en.courseLabel}</Link>
        {parents.map((item) => (
          <Link key={item.id} href={item.route}>
            <span lang="sr-Latn">{item.title}</span>
          </Link>
        ))}
      </nav>
      <h1 lang="sr-Latn">{page.item.title}</h1>
      <p className="muted">
        {en.curriculum.release}: {catalog.release.id} ·{' '}
        {en.curriculum.sourceContent}
      </p>
      {(overview || page.children.length > 0) && (
        <nav className="card mb-8" aria-label={en.curriculum.contents}>
          <ul className="curriculum-links">
            {(overview ? roots : page.children).map((item) => (
              <li key={item.id}>
                <Link href={item.route}>
                  <span lang="sr-Latn">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {page.item.kind === 'module' && (
        <p lang="sr-Latn" className="source">
          {page.item.bodyMarkdown}
        </p>
      )}
      {week && (
        <section className="card mb-8">
          <h2>{en.curriculum.weekEvidence}</h2>
          <p lang="sr-Latn" className="source">
            {week.mainEvidenceMarkdown}
          </p>
        </section>
      )}
      {day && ['lesson', 'exercise'].includes(page.item.kind) && (
        <section className="card mb-8">
          <h2>{en.learning.ai}</h2>
          <p lang="sr-Latn" className="source">
            {day.aiPolicyMarkdown}
          </p>
          <h2 className="mt-6">{en.learning.criterion}</h2>
          <p lang="sr-Latn" className="source">
            {day.completionCriterionMarkdown}
          </p>
        </section>
      )}
      <SourceBlocks blocks={page.blocks} />
      {page.item.kind === 'exercise' && (
        <section className="section">
          <h2>{en.curriculum.interpretations}</h2>
          {page.children.map((task) => {
            const rule = catalog.rules.find((r) => r.itemId === task.id)!;
            const interpretation = z
              .object({ completionRule: z.string() })
              .parse(JSON.parse(rule.ruleJson));
            return (
              <div className="card mb-4" key={task.id}>
                <p lang="sr-Latn">{task.bodyMarkdown}</p>
                <p className="mt-3">
                  {rule.requirementMode}: {interpretation.completionRule}
                </p>
              </div>
            );
          })}
        </section>
      )}
      {rule && <p>{rule.requirementMode}</p>}
      {page.uses.length > 0 && (
        <section className="section">
          <h2>{en.curriculum.references}</h2>
          {page.uses.map((use) => {
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
      {page.item.stableKey === 'resource-catalog' && (
        <section className="section">
          <h2>{en.curriculum.references}</h2>
          <ul className="curriculum-links">
            {catalog.resources.map((resource) => (
              <li key={resource.id}>
                <Link href={`/resources/${resource.stableKey}`}>
                  {resource.title}
                </Link>
                {resource.originalUrl ? '' : ` — ${en.curriculum.noUrl}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
