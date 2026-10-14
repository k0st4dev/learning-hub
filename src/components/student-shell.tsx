import { StudentNavigation } from './student-navigation';
import { TopUtilityBar } from './top-utility-bar';
import { en } from '@/i18n/en';

export function StudentShell({
  name,
  children,
  showFixtureNotice = true,
}: {
  name: string;
  children: React.ReactNode;
  showFixtureNotice?: boolean;
}) {
  return (
    <div className="page-shell student-workspace-layout">
      <StudentNavigation name={name} fullCourse={!showFixtureNotice} />
      <div className="student-workspace-content">
        <TopUtilityBar />
        {showFixtureNotice && (
          <aside className="preview-notice mb-8">
            <strong>{en.preview}</strong>
            <p>{en.previewDescription}</p>
          </aside>
        )}
        {children}
      </div>
    </div>
  );
}
