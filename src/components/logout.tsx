'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { writeApi } from '@/lib/client-api';
import { en } from '@/i18n/en';
import { allowLearningLeave } from '@/lib/learning-leave';
export function Logout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <span>
      <button
        className="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            if (!(await allowLearningLeave())) return;
            await writeApi('/api/auth/logout', 'POST');
            router.push('/login');
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {en.logout}
      </button>
      {error && <span role="alert">{en.auth.networkError}</span>}
    </span>
  );
}
