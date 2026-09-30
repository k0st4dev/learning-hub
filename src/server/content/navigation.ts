type Item = {
  id: string;
  parentId: string | null;
  kind: string;
  title: string;
  orderIndex: number;
  route: string;
};
type Input = {
  items: readonly Item[];
  days: readonly { itemId: string; dayNumber: number }[];
  weeks: readonly { itemId: string; weekNumber: number }[];
};
export type NavigationItem = Item & {
  dayNumber: number | null;
  weekNumber: number | null;
};
export type NavigationTarget =
  | { kind: 'content'; item: NavigationItem; href: string }
  | { kind: 'preparation' | 'progress'; href: string };
export type PageNavigation = {
  current: NavigationItem;
  breadcrumbs: NavigationItem[];
  mode: 'day' | 'unit' | null;
  previous: NavigationTarget | null;
  next: NavigationTarget | null;
};

// Pure reading model: source order only, independent of dates, completion and cursors.
export function courseNavigation(input: Input) {
  const original = new Map(input.items.map((item) => [item.id, item]));
  const days = new Map(input.days.map((day) => [day.itemId, day.dayNumber]));
  const weeks = new Map(
    input.weeks.map((week) => [week.itemId, week.weekNumber]),
  );
  function lineage(item: Item) {
    const chain: Item[] = [];
    const visited = new Set<string>();
    let current: Item | undefined = item;
    while (current) {
      if (visited.has(current.id))
        throw new Error('Invalid course navigation cycle');
      visited.add(current.id);
      chain.unshift(current);
      const parentId: string | null = current.parentId;
      current = parentId ? original.get(parentId) : undefined;
      if (parentId && !current)
        throw new Error('Missing course navigation parent');
    }
    return chain;
  }
  const items: NavigationItem[] = input.items.map((item) => {
    const chain = lineage(item);
    return {
      ...item,
      dayNumber:
        days.get(chain.find((ancestor) => ancestor.kind === 'day')?.id ?? '') ??
        null,
      weekNumber:
        weeks.get(
          chain.find((ancestor) => ancestor.kind === 'week')?.id ?? '',
        ) ?? null,
    };
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  const daySequence = items
    .filter((item) => item.kind === 'day')
    .sort((a, b) => a.dayNumber! - b.dayNumber!);
  const unitSequence = items
    .filter((item) => item.kind === 'lesson' || item.kind === 'exercise')
    .sort(
      (a, b) =>
        a.dayNumber! - b.dayNumber! ||
        Number(a.kind === 'exercise') - Number(b.kind === 'exercise'),
    );
  const target = (item: NavigationItem | undefined): NavigationTarget | null =>
    item ? { kind: 'content', item, href: item.route } : null;
  const children = (parentId: string | null) =>
    items
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  function forItem(id: string): PageNavigation | null {
    const current = byId.get(id);
    if (!current) return null;
    const breadcrumbs = lineage(current)
      .filter(
        (item) => !(current.kind === 'exercise' && item.kind === 'lesson'),
      )
      .map((item) => byId.get(item.id)!);
    const mode =
      current.kind === 'day'
        ? 'day'
        : ['lesson', 'exercise'].includes(current.kind)
          ? 'unit'
          : null;
    const sequence = mode === 'day' ? daySequence : unitSequence;
    const position = sequence.findIndex((item) => item.id === id);
    if (!mode)
      return { current, breadcrumbs, mode, previous: null, next: null };
    return {
      current,
      breadcrumbs,
      mode,
      previous:
        target(sequence[position - 1]) ??
        (mode === 'unit'
          ? {
              kind: 'preparation',
              href: '/course/software-engineer/preparation',
            }
          : null),
      next:
        target(sequence[position + 1]) ??
        (mode === 'unit'
          ? { kind: 'progress', href: '/course/software-engineer/progress' }
          : null),
    };
  }
  return { items, byId, children, daySequence, unitSequence, forItem };
}
