import { z } from 'zod';
export const unitSchema = z.object({
  id: z.string(),
  key: z.string(),
  kind: z.string(),
  dayId: z.string(),
  dayKey: z.string(),
  dayNumber: z.number().int(),
  complete: z.boolean(),
});
export const studyStateSchema = z.object({
  units: z.array(unitSchema),
  enrollment: z.object({ resumeItemId: z.string().nullable() }),
});
export function unitPath(
  unit: z.infer<typeof unitSchema>,
  anchor?: string | null,
) {
  return `/course/software-engineer/days/${unit.dayKey}/${unit.kind === 'lesson' ? 'lessons' : 'exercises'}/${unit.key}${anchor ? '#' + anchor : ''}`;
}
export function studyContext(
  state: z.infer<typeof studyStateSchema>,
  itemId: string,
) {
  const current = state.units.find((unit) => unit.id === itemId);
  if (!current) throw new Error('Learning unit unavailable');
  const day = state.units.filter((unit) => unit.dayId === current.dayId);
  const lesson = day.find((unit) => unit.kind === 'lesson');
  const exercise = day.find((unit) => unit.kind === 'exercise');
  if (!lesson || !exercise) throw new Error('Day requirements unavailable');
  const earliest = state.units.find((unit) => !unit.complete);
  const target = day.find((unit) => !unit.complete);
  return {
    lessonId: lesson.id,
    exerciseId: exercise.id,
    lessonPath: unitPath(lesson),
    exercisePath: unitPath(exercise),
    lessonComplete: lesson.complete,
    exerciseComplete: exercise.complete,
    studyTargetId: target?.id ?? null,
    studyTargetPath: target
      ? unitPath(target, target.kind === 'lesson' ? 'study' : 'tasks')
      : null,
    activeItemId: state.enrollment.resumeItemId,
    outOfSequence: !!earliest && current.dayNumber > earliest.dayNumber,
    recommendedPath: earliest
      ? unitPath(earliest)
      : '/course/software-engineer/progress',
    completed: day.filter((unit) => unit.complete).length,
    total: day.length,
  };
}
export type StudyContext = ReturnType<typeof studyContext>;
