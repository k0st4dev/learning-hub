/** Stable, product-owned sections; task keys come from the pinned curriculum. */
export function studyAnchors(kind: string, taskKeys: readonly string[] = []) {
  return kind === 'lesson'
    ? ['study', 'ai', 'criterion']
    : kind === 'exercise'
      ? ['tasks', ...taskKeys, 'ai', 'criterion', 'evidence']
      : [];
}
export function defaultStudyAnchor(kind: string) {
  return kind === 'lesson' ? 'study' : 'tasks';
}
