import Link from 'next/link';
import { dayWorkspace } from '@/server/content/day-workspace';
import { DailyContext, DailyWorkspace } from './daily-workspace';
import { ResourceCards } from './resource-cards';
import { z } from 'zod';
import type { Catalog, CatalogPage } from '@/server/content/read';
import { sourceLinkSchema } from '@/server/content/source-schema';
import { en } from '@/i18n/en';
import { courseNavigation, courseOutline } from '@/server/content/navigation';
import { CourseOutline } from './course-outline';
import { studyAnchors } from '@/domain/study-anchors';
import {
  appendixATemplate,
  aiPromptTemplates,
  type SourcePrompt,
} from '@/server/content/handbook-template';
import { CopyableText } from './copyable-text';
import {
  curriculumItemLabel,
  CurriculumNavigation,
  curriculumItemTitle,
} from './curriculum-navigation';
const base = '/course/software-engineer';
function SourceParagraph({
  block,
  anchors,
  prompt,
}: {
  block: CatalogPage['blocks'][number];
  anchors: readonly string[];
  prompt?: SourcePrompt;
}) {
  const links = z.array(sourceLinkSchema).parse(JSON.parse(block.linksJson));
  return (
    <div
      id={block.anchor ?? undefined}
      data-study-anchor={
        anchors.includes(block.anchor ?? '') ? block.anchor : undefined
      }
      tabIndex={anchors.includes(block.anchor ?? '') ? -1 : undefined}
      data-source-id={block.sourceLocator}
      className="source-paragraph"
    >
      <p data-source-text lang="sr-Latn" className="source">
        {block.exactText}
      </p>
      {prompt && (
        <details className="prompt-copy" data-copy-prompt={prompt.sourceId}>
          <summary>
            {en.handbook.promptCopy} ·{' '}
            <span lang="sr-Latn">{prompt.title}</span>
          </summary>
          <div className="stack">
            <p>{en.handbook.promptRules}</p>
            <a href={'#' + prompt.anchor}>{en.handbook.promptSource}</a>
            <CopyableText
              id={'prompt-' + prompt.sourceId}
              label={prompt.title + ' · ' + en.handbook.promptLabel}
              text={prompt.text}
              format="plain-text"
            />
          </div>
        </details>
      )}
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
export function SourceBlocks({
  blocks,
  anchors = [],
  prompts = [],
}: {
  blocks: CatalogPage['blocks'];
  anchors?: readonly string[];
  prompts?: readonly SourcePrompt[];
}) {
  const parts: React.ReactNode[] = [];
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index]!;
    if (block.tableNumber === null) {
      parts.push(
        <SourceParagraph
          key={block.id}
          block={block}
          anchors={anchors}
          prompt={prompts.find(
            (prompt) => prompt.sourceId === block.sourceLocator,
          )}
        />,
      );
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
                          <SourceParagraph
                            key={b.id}
                            block={b}
                            anchors={anchors}
                          />
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
  exerciseEditor,
  studyEditor,
  noteEditor,
  progressView,
  learnerTool,
  exerciseWorkAvailable = false,
}: {
  catalog: Catalog;
  page: CatalogPage;
  exerciseEditor?: React.ReactNode;
  studyEditor?: React.ReactNode;
  noteEditor?: React.ReactNode;
  progressView?: React.ReactNode;
  learnerTool?: React.ReactNode;
  exerciseWorkAvailable?: boolean;
}) {
  const overview = page.item.stableKey === 'overview';
  const template = appendixATemplate(page);
  const prompts = aiPromptTemplates(page);
  const sourceBlocks = page.blocks.map((block) => {
    const copy =
      block.sourceLocator === template?.sourceId
        ? template
        : prompts?.find((prompt) => prompt.sourceId === block.sourceLocator);
    return copy ? { ...block, anchor: copy.anchor } : block;
  });
  const workspace = dayWorkspace(catalog, page.item.id);
  const navigationModel = courseNavigation(catalog);
  const roots = navigationModel.items
    .filter(
      (i) =>
        (i.kind === 'module' || i.kind === 'guide') && i.id !== page.item.id,
    )
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const navigation = navigationModel.forItem(page.item.id)!;
  const parents = navigation.breadcrumbs.filter(
    (item) => item.id !== page.item.id,
  );
  const day = catalog.days.find(
    (d) => d.itemId === page.item.id || parents.some((p) => p.id === d.itemId),
  );
  const week = catalog.weeks.find((w) => w.itemId === page.item.id);
  const rule = catalog.rules.find((rule) => rule.itemId === page.item.id);
  const anchors = studyAnchors(
    page.item.kind,
    page.children
      .filter((item) => item.kind === 'task')
      .map((item) => item.stableKey),
  );
  return (
    <>
      <aside className="preview-notice mb-8">
        <strong>{en.curriculum.preview}</strong>
        <p>{en.curriculum.previewHelp}</p>
      </aside>
      <nav
        className="actions mb-8 course-breadcrumbs"
        aria-label={en.curriculum.breadcrumbs}
      >
        <Link href="/dashboard">{en.dashboard}</Link>
        {!overview && <Link href={base}>{en.courseLabel}</Link>}
        {parents.map((item) => (
          <Link key={item.id} href={item.route}>
            {curriculumItemLabel(item)}
          </Link>
        ))}
        <span aria-current="page">
          {curriculumItemLabel(navigation.current)}
        </span>
      </nav>
      <div className="course-reading-layout">
        <CourseOutline
          key={page.item.id}
          branches={courseOutline(navigationModel, page.item.id)}
          overview={overview}
        />
        <div
          className="course-reading-content"
          data-learning-unit={anchors.length ? page.item.id : undefined}
        >
          <h1>{curriculumItemTitle({ item: page.item })}</h1>
          <p className="muted">
            {en.curriculum.release}: {catalog.release.id} ·{' '}
            {en.curriculum.sourceContent}
          </p>
          {workspace && (
            <DailyContext workspace={workspace} currentId={page.item.id} />
          )}
          {progressView}
          {learnerTool}
          {prompts === null && (
            <p className="notice" role="status">
              {en.handbook.promptsUnavailable}
            </p>
          )}
          {template ? (
            <section
              className="card mb-8 stack"
              aria-labelledby="problem-template-title"
            >
              <h2 id="problem-template-title">{en.handbook.title}</h2>
              <p>{en.handbook.original}</p>
              <a href={'#' + template.anchor}>{en.handbook.source}</a>
              <CopyableText
                key={page.item.id + ':' + template.sourceId}
                id="problem-file-template"
                label={en.handbook.label}
                text={template.text}
              />
            </section>
          ) : page.item.stableKey === 'guide-appendix-a' ? (
            <p className="notice" role="status">
              {en.handbook.unavailable}
            </p>
          ) : null}
          {anchors.length > 0 && (
            <nav className="actions mb-8" aria-label="Lesson sections">
              <Link href={page.item.kind === 'lesson' ? '#study' : '#tasks'}>
                {page.item.kind === 'lesson'
                  ? en.learning.study
                  : en.learning.practice}
              </Link>
              <Link href="#ai">{en.learning.ai}</Link>
              <Link href="#criterion">{en.learning.criterion}</Link>
              {page.item.kind === 'exercise' && exerciseWorkAvailable && (
                <Link href="#evidence">Evidence</Link>
              )}
              {noteEditor && <Link href="#notes">Private notes</Link>}
            </nav>
          )}
          {page.item.kind !== 'day' &&
            (overview || page.children.length > 0) && (
              <nav className="card mb-8" aria-label={en.curriculum.contents}>
                <ul className="curriculum-links">
                  {(overview
                    ? roots
                    : navigationModel.children(page.item.id)
                  ).map((item) => (
                    <li key={item.id}>
                      <Link href={item.route}>{curriculumItemLabel(item)}</Link>
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
            <div className="card mb-8">
              <section id="ai" data-study-anchor="ai" tabIndex={-1}>
                <h2>{en.learning.ai}</h2>
                <p lang="sr-Latn" className="source">
                  {day.aiPolicyMarkdown}
                </p>
              </section>
              <section
                id="criterion"
                data-study-anchor="criterion"
                tabIndex={-1}
              >
                <h2 className="mt-6">{en.learning.criterion}</h2>
                <p lang="sr-Latn" className="source">
                  {day.completionCriterionMarkdown}
                </p>
              </section>
            </div>
          )}
          {page.item.kind === 'day' && workspace ? (
            <DailyWorkspace
              workspace={workspace}
              sourceHeader={
                <SourceBlocks
                  blocks={page.blocks.filter(
                    (block) =>
                      !['ai-policy', 'completion'].includes(block.anchor ?? ''),
                  )}
                />
              }
              sourceReview={
                <SourceBlocks
                  blocks={page.blocks.filter((block) =>
                    ['ai-policy', 'completion'].includes(block.anchor ?? ''),
                  )}
                />
              }
              resources={
                <ResourceCards
                  catalog={catalog}
                  uses={workspace.uses}
                  retryHref={page.item.route}
                />
              }
            />
          ) : page.item.kind === 'exercise' ? (
            <section
              id="tasks"
              data-study-anchor="tasks"
              tabIndex={-1}
              aria-label={en.learning.practice}
            >
              <SourceBlocks blocks={page.blocks} anchors={anchors} />
            </section>
          ) : (
            <SourceBlocks
              blocks={sourceBlocks}
              anchors={anchors}
              prompts={prompts ?? []}
            />
          )}
          {studyEditor}
          {exerciseEditor ??
            (page.item.kind === 'exercise' && (
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
            ))}
          {rule && <p>{rule.requirementMode}</p>}
          {noteEditor}
          {page.item.kind !== 'day' && (
            <ResourceCards
              catalog={catalog}
              uses={page.uses}
              retryHref={page.item.route}
            />
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
          <CurriculumNavigation navigation={navigation} />
        </div>
      </div>
    </>
  );
}
