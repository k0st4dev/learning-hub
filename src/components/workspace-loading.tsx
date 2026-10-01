import { en } from '@/i18n/en';
export function WorkspaceLoading() {
  return (
    <div className="page-shell" aria-busy="true">
      <p role="status" aria-live="polite">
        {en.routeState.loading}
      </p>
      <div className="workspace-skeleton" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
