import { StudentNavigation } from './student-navigation';
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
