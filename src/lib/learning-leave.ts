type DeferredLeave = { defer: (work: () => Promise<boolean>) => void };
export function beginLearningLeave() {
  const work: (() => Promise<boolean>)[] = [];
  const allowed = document.dispatchEvent(
    new CustomEvent<DeferredLeave>('learning:before-leave', {
      cancelable: true,
      detail: { defer: (task) => work.push(task) },
    }),
  );
  return {
    allowed,
    pending:
      allowed && work.length
        ? (async () => {
            for (const task of work) if (!(await task())) return false;
            return true;
          })().catch(() => false)
        : null,
  };
}
export async function allowLearningLeave() {
  const leave = beginLearningLeave();
  return leave.allowed && (leave.pending ? await leave.pending : true);
}
export function deferLearningLeave(event: Event, work: () => Promise<boolean>) {
  if (event instanceof CustomEvent && event.detail?.defer) {
    (event.detail as DeferredLeave).defer(work);
    return true;
  }
  return false;
}
