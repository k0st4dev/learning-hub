import Link from 'next/link';
import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { readSettings } from '@/server/account/settings';
import { AppError } from '@/server/errors';
import { StudentShell } from '@/components/student-shell';
import { SettingsEditor } from '@/components/settings-editor';
import { PasswordChangeForm } from '@/components/password-change-form';
export default async function SettingsPage() {
  const { student, token } = await pageStudent('/settings');
  let initial;
  try {
    initial = readSettings(getStore(), token, student.id);
  } catch (cause) {
    if (!(cause instanceof AppError) || cause.status !== 503) throw cause;
  }
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={false}
    >
      <h1>Settings</h1>
      <p className="mb-8">Manage your local account and appearance.</p>
      {initial ? (
        <SettingsEditor key={student.id} initial={initial} />
      ) : (
        <div role="alert" className="error-summary">
          <p>Saved settings are unavailable. Preserve your data and retry.</p>
          <Link href="/settings">Retry settings</Link>
        </div>
      )}
      <PasswordChangeForm
        key={'password:' + student.id}
        studentId={student.id}
        email={student.email}
      />
      <section className="section">
        <h2>Saved on this computer</h2>
        <p>
          Your account, confirmed settings and learning records are stored in
          this installation’s local database. Closing the browser or restarting
          the application does not erase them. Keep the data directory when
          updating the application. Clearing a browser’s history does not delete
          the database.
        </p>
        <p>
          Changes are saved only after you choose Save settings and receive
          confirmation. This installation does not synchronize accounts between
          computers.
        </p>
      </section>
    </StudentShell>
  );
}
