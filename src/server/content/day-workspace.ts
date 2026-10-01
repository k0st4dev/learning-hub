import type { Catalog } from './read';

export function dayWorkspace(catalog: Catalog, itemId: string) {
  let item = catalog.items.find((item) => item.id === itemId);
  if (!item || !['day', 'lesson', 'exercise'].includes(item.kind)) return null;
  while (item.kind !== 'day') {
    const parent = catalog.items.find((parent) => parent.id === item!.parentId);
    if (!parent) throw new Error('Missing published day ancestry');
    item = parent;
  }
  const dayItem = item;
  const day = catalog.days.find((day) => day.itemId === dayItem.id);
  const week = catalog.weeks.find((week) => week.itemId === dayItem.parentId);
  const lesson = catalog.items.find(
    (item) => item.parentId === dayItem.id && item.kind === 'lesson',
  );
  const exercise = catalog.items.find(
    (item) => item.parentId === lesson?.id && item.kind === 'exercise',
  );
  if (!day || !week || !lesson || !exercise)
    throw new Error('Incomplete published daily workspace');
  return {
    dayItem,
    day,
    week,
    lesson,
    exercise,
    tasks: catalog.items
      .filter((item) => item.parentId === exercise.id && item.kind === 'task')
      .sort((a, b) => a.orderIndex - b.orderIndex),
    uses: catalog.uses.filter((use) => use.contentItemId === lesson.id),
  };
}
export type DayWorkspace = NonNullable<ReturnType<typeof dayWorkspace>>;
