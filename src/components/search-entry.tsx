'use client';
import { useRouter } from 'next/navigation';
import { allowLearningLeave } from '@/lib/learning-leave';

export function SearchEntry() {
  const router = useRouter();
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="actions section"
      onSubmit={async (event) => {
        event.preventDefault();
        const q = String(new FormData(event.currentTarget).get('q') ?? '');
        if (await allowLearningLeave())
          router.push(
            '/search?' + new URLSearchParams({ q, kind: 'resource' }),
          );
      }}
    >
      <label>
        Search resources
        <input name="q" type="search" maxLength={100} />
      </label>
      <input type="hidden" name="kind" value="resource" />
      <button className="button" type="submit">
        Search resources
      </button>
    </form>
  );
}
