import { publishedPage } from '@/server/content/page';
import { FullCurriculumPage } from '@/components/full-curriculum-page';
import { StudentShell } from '@/components/student-shell';
import { ScorecardEditor } from '@/components/scorecard-editor';
import { getStore } from '@/server/db/current';
import { ownedEnrollment } from '@/server/learning/read';
import { readScorecard } from '@/server/learning/scorecards';
import { scorecardPeriodSchema } from '@/domain/scorecards';
import { AppError } from '@/server/errors';
import Link from 'next/link';
export default async function ScorecardSource({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { student, catalog, token } = await publishedPage(
    '/progress/scorecard',
  );
  const { period } = await searchParams;
  const store = getStore();
  let editor: React.ReactNode;
  if (!ownedEnrollment(store, token))
    editor = (
      <p className="section">
        <Link href="/course/software-engineer">
          Start the course to save a private review
        </Link>
      </p>
    );
  else if (
    period !== undefined &&
    !scorecardPeriodSchema.safeParse(period).success
  )
    editor = (
      <div className="section error-summary" role="alert">
        <p>Choose a valid review month (YYYY-MM).</p>
        <Link href="/progress/scorecard">Open current month</Link>
      </div>
    );
  else {
    let initial: ReturnType<typeof readScorecard> | undefined;
    try {
      initial = readScorecard(store, token, period, student.id);
    } catch (cause) {
      if (!(cause instanceof AppError) || cause.status !== 503) throw cause;
    }
    editor = initial ? (
      <ScorecardEditor
        key={'scorecard:' + student.id + ':' + initial.periodKey}
        studentId={student.id}
        timezone={student.timezone}
        initial={initial}
      />
    ) : (
      <div className="section error-summary" role="alert">
        <p>Saved reviews are unavailable. Preserve your data and retry.</p>
        <Link
          href={
            period
              ? '/progress/scorecard?period=' +
                encodeURIComponent(period as string)
              : '/progress/scorecard'
          }
        >
          Retry saved review
        </Link>
      </div>
    );
  }
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={false}
    >
      <FullCurriculumPage
        catalog={catalog}
        route="/progress/scorecard"
        learnerTool={editor}
      />
    </StudentShell>
  );
}
