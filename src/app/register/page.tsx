import { AuthForm } from '@/components/auth-form';
import { en } from '@/i18n/en';
import { redirectSignedInStudent } from '@/server/auth/page';
export default async function Register() {
  await redirectSignedInStudent();
  return (
    <div className="page-shell narrow">
      <h1>{en.register}</h1>
      <p>{en.auth.localHelp}</p>
      <AuthForm mode="register" />
    </div>
  );
}
