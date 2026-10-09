import { and, eq, sql } from 'drizzle-orm';
import type { Store } from '../db/connection';
import { currentUser } from '../auth/service';
import { latestRelease, ownedEnrollment, coursePath } from '../learning/read';
import * as s from '../db/schema';
import { AppError } from '../errors';
import {
  isDerivedResourceKey,
  resourceMentionPresentation,
} from './resource-mentions';
import { readCatalog } from './read';

export type CourseIssue = 'missing' | 'setup' | 'unpublished' | 'unavailable';
export function isCourseRoute(path: string) {
  return (
    path === coursePath ||
    path.startsWith(`${coursePath}/`) ||
    path === '/resources' ||
    path.startsWith('/resources/') ||
    path === '/progress/scorecard'
  );
}

// A small pre-stream read sets meaningful 404/503 statuses. Pages still enforce
// authentication and ownership themselves; this check never grants access.
export function courseAvailability(
  store: Store,
  token: string | undefined,
  path: string,
): CourseIssue | null {
  if (!currentUser(store, token)) return null;
  const pinned = ownedEnrollment(store, token);
  const release = pinned
    ? store.orm
        .select()
        .from(s.courseRelease)
        .where(eq(s.courseRelease.id, pinned.releaseId))
        .get()
    : latestRelease(store);
  if (!release) return 'setup';
  if (release.status !== 'published') return 'unpublished';
  if (release.id.startsWith('development-')) {
    if (!path.startsWith(coursePath)) return 'unpublished';
    return [
      '',
      '/preparation',
      '/progress',
      '/days/d001',
      '/days/d001/lessons/d001-learn',
      '/days/d001/exercises/d001-practice',
    ].some((suffix) => path === coursePath + suffix)
      ? null
      : 'missing';
  }
  if (path === `${coursePath}/progress`) return null;
  const exists = path.startsWith('/resources/')
    ? store.orm
        .select({ id: s.resource.id })
        .from(s.resource)
        .where(
          and(
            eq(s.resource.releaseId, release.id),
            eq(s.resource.stableKey, path.slice('/resources/'.length)),
          ),
        )
        .get()
    : store.orm
        .select({ id: s.contentItem.id })
        .from(s.contentItem)
        .where(
          and(
            eq(s.contentItem.releaseId, release.id),
            sql`json_extract(${s.contentItem.metadataJson}, '$.route') = ${path}`,
          ),
        )
        .get();
  if (exists) return null;
  if (
    path.startsWith('/resources/') &&
    isDerivedResourceKey(release.id, path.slice('/resources/'.length))
  ) {
    const catalog = readCatalog(store, release.id);
    if (!catalog) return 'unavailable';
    resourceMentionPresentation(catalog);
    return null;
  }
  return 'missing';
}
export function availabilityFailure(error: unknown): CourseIssue {
  return error instanceof AppError && error.code === 'SETUP_REQUIRED'
    ? 'setup'
    : 'unavailable';
}
