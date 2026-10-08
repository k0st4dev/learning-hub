import Link from 'next/link';
import type { ScorecardReviewMilestone } from '@/domain/scorecard-review';

export function ScorecardReviewReminders({
  milestones,
}: {
  milestones: ScorecardReviewMilestone[];
}) {
  if (!milestones.length) return null;
  return (
    <section className="notice stack" aria-label="Scorecard review reminder">
      <h2>Reflect on your completed milestones</h2>
      <p>
        These completed milestones are opportunities to review the original
        14-area scorecard:
      </p>
      <ul>
        {milestones.map((milestone) => (
          <li key={milestone.key}>{milestone.label}</li>
        ))}
      </ul>
      <p>
        This reflection is optional and adds no course credit. Review your work
        and evidence at your own pace.
      </p>
      <Link className="button" href="/progress/scorecard">
        Review this month’s scorecard
      </Link>
      <p className="muted">
        If this month already has a saved review, it opens for deliberate
        revision.
      </p>
    </section>
  );
}
