'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { en } from '@/i18n/en';

type Props = {
  identity: string;
  title: string;
  help: string;
  items: readonly { id: string; text: string }[];
  sourceHref: string;
};

export function TemporaryChecklist(props: Props) {
  const pathname = usePathname();
  return <Review key={JSON.stringify([props.identity, pathname])} {...props} />;
}

function Review({ title, help, items, sourceHref }: Props) {
  const id = useId();
  const [marked, setMarked] = useState<string[]>([]);
  useEffect(() => {
    const reset = () => setMarked([]);
    window.addEventListener('pagehide', reset);
    window.addEventListener('pageshow', reset);
    return () => {
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('pageshow', reset);
    };
  }, []);
  return (
    <section
      className="card mb-8 stack temporary-review"
      aria-labelledby={id + '-title'}
    >
      <h2 id={id + '-title'}>{title}</h2>
      <p id={id + '-notice'}>{en.handbook.temporaryNotice}</p>
      <p id={id + '-help'}>{help}</p>
      <fieldset
        className="exercise-fields"
        aria-describedby={id + '-notice ' + id + '-help'}
      >
        <legend>{en.handbook.reviewChecks}</legend>
        {items.map((item) => (
          <label className="check" key={item.id} htmlFor={id + '-' + item.id}>
            <input
              id={id + '-' + item.id}
              data-review-source={item.id}
              type="checkbox"
              checked={marked.includes(item.id)}
              onChange={(event) => {
                const checked = event.target.checked;
                setMarked((current) =>
                  checked
                    ? [...current.filter((ref) => ref !== item.id), item.id]
                    : current.filter((ref) => ref !== item.id),
                );
              }}
            />
            <span lang="sr-Latn">{item.text}</span>
          </label>
        ))}
      </fieldset>
      <p role="status">
        {en.handbook.markedReview}: {marked.length} / {items.length}
      </p>
      <div className="actions">
        <button type="button" className="button" onClick={() => setMarked([])}>
          {en.handbook.clearReview}
        </button>
        <a href={sourceHref}>{en.handbook.readOriginalReview}</a>
      </div>
    </section>
  );
}
