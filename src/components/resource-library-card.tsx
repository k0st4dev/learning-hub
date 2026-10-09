import Link from 'next/link';
import { ResourceConnection } from './resource-connection';
import { ResourceNamedMention } from './resource-named-mention';
import { isHistoricalBindingCaveat } from '@/domain/resource-binding-view';
import type { ResourceLibraryView } from '@/domain/resource-library-view';
import {
  resourceTypeLabels,
  resourceRequirementLabels,
} from '@/domain/resource-library-view';

export function ResourceLibraryCard({
  resource,
  rank,
  detail = false,
}: {
  resource: ResourceLibraryView['results'][number];
  rank?: number;
  detail?: boolean;
}) {
  const matching = resource.uses.filter((use) =>
    resource.matchingUseIds.includes(use.id),
  );
  const Container = detail ? 'article' : 'li';
  return (
    <Container
      className="card resource-library-card stack"
      {...(detail ? {} : { value: rank })}
    >
      {!detail && (
        <h3>
          <Link prefetch={false} href={resource.href}>
            {resource.title}
          </Link>
        </h3>
      )}
      <p>
        <strong>{resourceTypeLabels[resource.effective.type]}</strong> ·{' '}
        {resource.effective.provider ?? 'Provider not specified in manual'}
      </p>
      {resource.recordOrigin === 'added-product-interpretation' && (
        <p>
          Added resource entry and title, based on the original named reference.
        </p>
      )}
      {!detail && resource.descriptionMarkdown && (
        <p className="source" lang="sr-Latn">
          {resource.descriptionMarkdown}
        </p>
      )}
      {resource.parent && resource.parent.href !== resource.href && (
        <div className="stack">
          <p>
            The manual supplies a parent URL; no direct section link is
            supplied.
          </p>
          <Link prefetch={false} href={resource.parent.href}>
            Parent resource: {resource.parent.title}
          </Link>
          <a
            href={resource.parent.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open parent {resource.parent.title} (new tab)
          </a>
        </div>
      )}
      {resource.originalUrl ? (
        <a
          href={resource.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open {resource.title} (new tab)
        </a>
      ) : (
        <p>No direct link supplied in the manual.</p>
      )}
      {resource.resolvedUrl &&
        resource.resolvedUrl !== resource.originalUrl && (
          <a
            href={resource.resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open reviewed replacement (new tab)
          </a>
        )}
      <p className="muted">
        {resource.linkStatus === 'unchecked'
          ? 'Link availability not checked.'
          : 'Link status: ' +
            resource.linkStatus +
            (resource.checkedAt
              ? ' · Checked ' +
                new Date(resource.checkedAt).toISOString().slice(0, 10)
              : '')}
      </p>
      {!detail && matching.length > 0 && (
        <div>
          <h4>Matching assignments</h4>
          <ul className="curriculum-links">
            {matching.slice(0, 3).map((use) => (
              <li key={use.id}>
                <Link prefetch={false} href={use.href}>
                  <span lang="sr-Latn">
                    {use.dayNumber ? 'Day ' + use.dayNumber + ' — ' : ''}
                    {use.title}
                  </span>
                </Link>
                {' · '}
                {resourceRequirementLabels[use.effective.requirementMode]}
                <p lang="sr-Latn" className="source">
                  {use.assignedText}
                </p>
              </li>
            ))}
          </ul>
          {matching.length > 3 && (
            <p>
              {matching.length - 3} more matching assignments are available
              below.
            </p>
          )}
        </div>
      )}
      {resource.relatedDays.length > 0 && (
        <details>
          <summary>Related days ({resource.relatedDays.length})</summary>
          <ul className="curriculum-links">
            {resource.relatedDays.map((day) => (
              <li key={day.href}>
                <Link prefetch={false} href={day.href}>
                  <span lang="sr-Latn">
                    Day {day.dayNumber} — {day.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>Original metadata and added labels</summary>
        {resource.recordOrigin === 'added-product-interpretation' ? (
          <p>
            This is an added resource interpretation. Original instructions and
            associations are shown in Named references below.
          </p>
        ) : (
          <p>
            Imported source name: {resource.sourceName}. Imported type label:{' '}
            {resource.type}. Link origin: {resource.linkOrigin}.
          </p>
        )}
        <p>
          {resource.interpretation.origin === 'added-product-interpretation'
            ? 'Type, provider and assignment labels are added product interpretations; original wording is preserved.'
            : 'Labels use this release’s imported metadata.'}
        </p>
        {resource.interpretation.rationale && (
          <p>{resource.interpretation.rationale}</p>
        )}
        {resource.interpretation.ambiguity && (
          <p>
            Interpretation includes an unspecified choice or vocabulary
            decision. Review its evidence.
          </p>
        )}
        {resource.interpretation.confidence && (
          <p>
            Interpretation confidence: {resource.interpretation.confidence}.
          </p>
        )}
        {resource.interpretation.evidence.map((evidence) => (
          <blockquote key={evidence.sourceId}>
            <span>
              {evidence.sourceId}
              {evidence.table === null
                ? ''
                : ` · Table ${evidence.table}, row ${evidence.row}, cell ${evidence.cell}`}
            </span>
            <p lang="sr-Latn">{evidence.exactText}</p>
          </blockquote>
        ))}
      </details>
      {!!resource.derivedMentions?.length && (
        <section className="stack" aria-label="Named references">
          <h4>Named references ({resource.derivedMentions.length})</h4>
          {resource.derivedMentions.map((mention) => (
            <ResourceNamedMention
              key={mention.key}
              mention={mention}
              matching={
                !detail && !!resource.matchingMentionKeys?.includes(mention.key)
              }
            />
          ))}
        </section>
      )}
      <details>
        <summary>
          Current assignments and source evidence ({resource.uses.length})
        </summary>
        <ul className="curriculum-links">
          {resource.uses.map((use) => (
            <li key={use.id} data-resource-use={use.id}>
              <Link prefetch={false} href={use.href}>
                <span lang="sr-Latn">
                  {use.dayNumber ? 'Day ' + use.dayNumber + ' — ' : ''}
                  {use.title}
                </span>
              </Link>
              {' · '}
              <strong>
                {resourceRequirementLabels[use.effective.requirementMode]}
              </strong>
              {!detail && resource.matchingUseIds.includes(use.id) && (
                <span> · Matches current filters</span>
              )}
              <p className="source" lang="sr-Latn">
                {use.assignedText}
              </p>
              {use.sectionLocator &&
                use.sectionLocator !== use.assignedText && (
                  <p className="source" lang="sr-Latn">
                    Section: {use.sectionLocator}
                  </p>
                )}
              <ResourceConnection binding={use.binding} />
              <details>
                <summary>Why this assignment has this label</summary>
                <p>
                  Original mode: {use.requirementMode}.{' '}
                  {use.interpretation.ruleDescription}
                </p>
                {use.interpretation.choiceGroup && (
                  <p>
                    Choose one of the alternatives in the original assignment;
                    do not require both.
                  </p>
                )}
                {use.interpretation.caveats.map((text, index) =>
                  isHistoricalBindingCaveat(use.binding, text) ? (
                    <details key={index}>
                      <summary>
                        Earlier label review note — connection now corrected
                      </summary>
                      <p>{text}</p>
                    </details>
                  ) : (
                    <p key={index}>{text}</p>
                  ),
                )}
                {use.interpretation.evidence.map((evidence) => (
                  <blockquote key={evidence.sourceId}>
                    <span>{evidence.sourceId}</span>
                    <p lang="sr-Latn">{evidence.exactText}</p>
                  </blockquote>
                ))}
              </details>
            </li>
          ))}
        </ul>
        {!resource.uses.length && !resource.derivedMentions?.length && (
          <p>No assigned lesson context in this release.</p>
        )}
      </details>
      {resource.originalUses.some((use) => use.binding.changed) && (
        <details>
          <summary>
            Original imported assignments ({resource.originalUses.length})
          </summary>
          <p>
            These are the preserved original associations. Current assignments
            use the reviewed connections above.
          </p>
          <ul className="curriculum-links">
            {resource.originalUses.map((use) => (
              <li key={use.id} data-resource-original-use={use.id}>
                <Link prefetch={false} href={use.href}>
                  <span lang="sr-Latn">{use.title}</span>
                </Link>
                <p className="source" lang="sr-Latn">
                  {use.assignedText}
                </p>
                <ResourceConnection binding={use.binding} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </Container>
  );
}
