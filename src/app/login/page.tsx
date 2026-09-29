import { AuthForm } from '@/components/auth-form';
import { en } from '@/i18n/en';
import { safeReturnPath } from '@/server/auth/service';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="page-shell narrow">
      <h1>{en.login}</h1>
      <AuthForm
        mode="login"
        email={typeof params.email === 'string' ? params.email : ''}
        registered={params.registered === '1'}
        returnTo={safeReturnPath(
          typeof params.returnTo === 'string' ? params.returnTo : undefined,
        )}
      />
      <p className="muted mt-8">{en.auth.recovery}</p>
    </div>
  );
}
