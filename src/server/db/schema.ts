// Typed equivalent of the reviewed handoff DDL. Never use schema push against student data.
import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  unique,
  index,
  foreignKey,
  check,
} from 'drizzle-orm/sqlite-core';

export const appUser = sqliteTable(
  'app_user',
  {
    id: text('id').primaryKey().notNull(),
    email: text('email').notNull(),
    emailCanonical: text('email_canonical').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull().default(sql.raw("''")),
    timezone: text('timezone').notNull().default(sql.raw("'UTC'")),
    uiLocale: text('ui_locale').notNull().default(sql.raw("'en'")),
    theme: text('theme').notNull().default(sql.raw("'system'")),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    unique('app_user_email_canonical_unique').on(table.emailCanonical),
    check('app_user_check_0', sql.raw("theme IN ('light','dark','system')")),
  ],
);

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    index('session_user_id_expires_at_index').on(table.userId, table.expiresAt),
    unique('session_token_hash_unique').on(table.tokenHash),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUser.id],
    }).onDelete('cascade'),
    check('session_check_0', sql.raw('expires_at > created_at')),
  ],
);

export const authThrottle = sqliteTable(
  'auth_throttle',
  {
    keyHash: text('key_hash').primaryKey().notNull(),
    failureCount: integer('failure_count').notNull().default(sql.raw('0')),
    windowStartedAt: integer('window_started_at').notNull(),
    blockedUntil: integer('blocked_until'),
  },
  () => [check('auth_throttle_check_0', sql.raw('failure_count >= 0'))],
);

export const course = sqliteTable(
  'course',
  {
    id: text('id').primaryKey().notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [unique('course_slug_unique').on(table.slug)],
);

export const courseRelease = sqliteTable(
  'course_release',
  {
    id: text('id').primaryKey().notNull(),
    courseId: text('course_id').notNull(),
    version: text('version').notNull(),
    status: text('status').notNull(),
    sourceFilename: text('source_filename').notNull(),
    sourceSha256: text('source_sha256').notNull(),
    manifestSha256: text('manifest_sha256').notNull(),
    contentLanguage: text('content_language')
      .notNull()
      .default(sql.raw("'sr-Latn'")),
    sourceVerifiedDate: text('source_verified_date'),
    publishedAt: integer('published_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    unique('course_release_id_course_id_unique').on(table.id, table.courseId),
    unique('course_release_course_id_version_unique').on(
      table.courseId,
      table.version,
    ),
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
    }).onDelete('restrict'),
    check(
      'course_release_check_0',
      sql.raw("status IN ('draft','published','retired')"),
    ),
  ],
);

export const contentItem = sqliteTable(
  'content_item',
  {
    id: text('id').primaryKey().notNull(),
    releaseId: text('release_id').notNull(),
    stableKey: text('stable_key').notNull(),
    kind: text('kind').notNull(),
    parentId: text('parent_id'),
    orderIndex: integer('order_index').notNull(),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull().default(sql.raw("''")),
    required: integer('required').notNull().default(sql.raw('1')),
    contentHash: text('content_hash').notNull(),
    metadataJson: text('metadata_json').notNull().default(sql.raw("'{}'")),
  },
  (table) => [
    index('content_item_release_id_parent_id_order_index_index').on(
      table.releaseId,
      table.parentId,
      table.orderIndex,
    ),
    unique('content_item_id_release_id_unique').on(table.id, table.releaseId),
    unique('content_item_release_id_stable_key_unique').on(
      table.releaseId,
      table.stableKey,
    ),
    foreignKey({
      columns: [table.parentId, table.releaseId],
      foreignColumns: [table.id, table.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.releaseId],
      foreignColumns: [courseRelease.id],
    }).onDelete('restrict'),
    check(
      'content_item_check_0',
      sql.raw(
        "kind IN ('module','week','day','lesson','exercise','task','guide','preparation')",
      ),
    ),
    check('content_item_check_1', sql.raw('order_index >= 0')),
    check('content_item_check_2', sql.raw('required IN (0,1)')),
    check('content_item_check_3', sql.raw('json_valid(metadata_json)')),
  ],
);

export const courseModule = sqliteTable(
  'course_module',
  {
    itemId: text('item_id').primaryKey().notNull(),
    phaseNumber: integer('phase_number').notNull(),
    introductionMarkdown: text('introduction_markdown')
      .notNull()
      .default(sql.raw("''")),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [contentItem.id],
    }).onDelete('restrict'),
    check('course_module_check_0', sql.raw('phase_number BETWEEN 1 AND 6')),
  ],
);

export const courseWeek = sqliteTable(
  'course_week',
  {
    itemId: text('item_id').primaryKey().notNull(),
    weekNumber: integer('week_number').notNull(),
    objectiveMarkdown: text('objective_markdown').notNull(),
    primaryResourcesText: text('primary_resources_text').notNull(),
    mainEvidenceMarkdown: text('main_evidence_markdown').notNull(),
    sourceDateRange: text('source_date_range').notNull(),
    phaseSignalMarkdown: text('phase_signal_markdown'),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [contentItem.id],
    }).onDelete('restrict'),
    check('course_week_check_0', sql.raw('week_number BETWEEN 1 AND 26')),
  ],
);

export const courseDay = sqliteTable(
  'course_day',
  {
    itemId: text('item_id').primaryKey().notNull(),
    dayNumber: integer('day_number').notNull(),
    sourceDate: text('source_date').notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    aiPolicyMarkdown: text('ai_policy_markdown').notNull(),
    completionCriterionMarkdown: text(
      'completion_criterion_markdown',
    ).notNull(),
    assessmentKind: text('assessment_kind').notNull(),
    remediationJson: text('remediation_json')
      .notNull()
      .default(sql.raw("'{}'")),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [contentItem.id],
    }).onDelete('restrict'),
    check('course_day_check_0', sql.raw('day_number BETWEEN 1 AND 182')),
    check('course_day_check_1', sql.raw('estimated_minutes > 0')),
    check(
      'course_day_check_2',
      sql.raw(
        "assessment_kind IN ('practice','weekly_checkpoint','final_exam')",
      ),
    ),
    check('course_day_check_3', sql.raw('json_valid(remediation_json)')),
  ],
);

export const lesson = sqliteTable(
  'lesson',
  {
    itemId: text('item_id').primaryKey().notNull(),
    objectiveMarkdown: text('objective_markdown'),
    studyInstructionMarkdown: text('study_instruction_markdown').notNull(),
    blocksJson: text('blocks_json').notNull().default(sql.raw("'[]'")),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [contentItem.id],
    }).onDelete('restrict'),
    check('lesson_check_0', sql.raw('json_valid(blocks_json)')),
  ],
);

export const exercise = sqliteTable(
  'exercise',
  {
    itemId: text('item_id').primaryKey().notNull(),
    relatedLessonId: text('related_lesson_id').notNull(),
    instructionsMarkdown: text('instructions_markdown').notNull(),
    expectedResultMarkdown: text('expected_result_markdown').notNull(),
    difficulty: text('difficulty'),
    estimatedMinutes: integer('estimated_minutes'),
    hintsJson: text('hints_json').notNull().default(sql.raw("'[]'")),
    solutionMarkdown: text('solution_markdown'),
    helpPolicy: text('help_policy')
      .notNull()
      .default(sql.raw("'source_rules'")),
    evidenceRequired: integer('evidence_required')
      .notNull()
      .default(sql.raw('1')),
  },
  (table) => [
    foreignKey({
      columns: [table.relatedLessonId],
      foreignColumns: [lesson.itemId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [contentItem.id],
    }).onDelete('restrict'),
    check(
      'exercise_check_0',
      sql.raw("difficulty IN ('introductory','developing','advanced')"),
    ),
    check('exercise_check_1', sql.raw('estimated_minutes > 0')),
    check('exercise_check_2', sql.raw('json_valid(hints_json)')),
    check('exercise_check_3', sql.raw('evidence_required IN (0,1)')),
  ],
);

export const exerciseTask = sqliteTable(
  'exercise_task',
  {
    itemId: text('item_id').primaryKey().notNull(),
    requirementMode: text('requirement_mode').notNull(),
    ruleJson: text('rule_json').notNull().default(sql.raw("'{}'")),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [contentItem.id],
    }).onDelete('restrict'),
    check(
      'exercise_task_check_0',
      sql.raw(
        "requirement_mode IN ('required','optional','conditional','alternative','mixed')",
      ),
    ),
    check('exercise_task_check_1', sql.raw('json_valid(rule_json)')),
  ],
);

export const resource = sqliteTable(
  'resource',
  {
    id: text('id').primaryKey().notNull(),
    releaseId: text('release_id').notNull(),
    stableKey: text('stable_key').notNull(),
    title: text('title').notNull(),
    originalUrl: text('original_url'),
    resolvedUrl: text('resolved_url'),
    sourceName: text('source_name').notNull(),
    type: text('type').notNull(),
    descriptionMarkdown: text('description_markdown')
      .notNull()
      .default(sql.raw("''")),
    linkOrigin: text('link_origin').notNull(),
    linkStatus: text('link_status').notNull().default(sql.raw("'unchecked'")),
    checkedAt: integer('checked_at'),
  },
  (table) => [
    unique('resource_id_release_id_unique').on(table.id, table.releaseId),
    unique('resource_release_id_stable_key_unique').on(
      table.releaseId,
      table.stableKey,
    ),
    foreignKey({
      columns: [table.releaseId],
      foreignColumns: [courseRelease.id],
    }).onDelete('restrict'),
    check(
      'resource_check_0',
      sql.raw(
        "type IN ('documentation','article','video','course','tool','reference','practice','guide')",
      ),
    ),
    check(
      'resource_check_1',
      sql.raw("link_origin IN ('source','verified_enrichment','unresolved')"),
    ),
    check(
      'resource_check_2',
      sql.raw("link_status IN ('unchecked','ok','redirect','unavailable')"),
    ),
  ],
);

export const resourceUse = sqliteTable(
  'resource_use',
  {
    id: text('id').primaryKey().notNull(),
    releaseId: text('release_id').notNull(),
    resourceId: text('resource_id').notNull(),
    contentItemId: text('content_item_id').notNull(),
    assignedText: text('assigned_text').notNull(),
    sectionLocator: text('section_locator'),
    requirementMode: text('requirement_mode').notNull(),
    orderIndex: integer('order_index').notNull(),
  },
  (table) => [
    index('resource_use_content_item_id_order_index_index').on(
      table.contentItemId,
      table.orderIndex,
    ),
    foreignKey({
      columns: [table.contentItemId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.resourceId, table.releaseId],
      foreignColumns: [resource.id, resource.releaseId],
    }).onDelete('restrict'),
    check(
      'resource_use_check_0',
      sql.raw(
        "requirement_mode IN ('required','optional','reference','conditional')",
      ),
    ),
  ],
);

export const sourceBlock = sqliteTable(
  'source_block',
  {
    id: text('id').primaryKey().notNull(),
    releaseId: text('release_id').notNull(),
    sourceLocator: text('source_locator').notNull(),
    sourceStyle: text('source_style').notNull(),
    tableNumber: integer('table_number'),
    rowNumber: integer('row_number'),
    cellNumber: integer('cell_number'),
    exactText: text('exact_text').notNull(),
    linksJson: text('links_json').notNull().default(sql.raw("'[]'")),
    textSha256: text('text_sha256').notNull(),
  },
  (table) => [
    unique('source_block_id_release_id_unique').on(table.id, table.releaseId),
    unique('source_block_release_id_source_locator_unique').on(
      table.releaseId,
      table.sourceLocator,
    ),
    foreignKey({
      columns: [table.releaseId],
      foreignColumns: [courseRelease.id],
    }).onDelete('restrict'),
    check('source_block_check_0', sql.raw('json_valid(links_json)')),
  ],
);

export const sourceMapping = sqliteTable(
  'source_mapping',
  {
    id: text('id').primaryKey().notNull(),
    releaseId: text('release_id').notNull(),
    sourceBlockId: text('source_block_id').notNull(),
    contentItemId: text('content_item_id').notNull(),
    targetField: text('target_field').notNull(),
    websiteLocation: text('website_location').notNull(),
    mappingKind: text('mapping_kind').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contentItemId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.sourceBlockId, table.releaseId],
      foreignColumns: [sourceBlock.id, sourceBlock.releaseId],
    }).onDelete('restrict'),
    check(
      'source_mapping_check_0',
      sql.raw(
        "mapping_kind IN ('verbatim','structured','reference','metadata')",
      ),
    ),
  ],
);

export const enrollment = sqliteTable(
  'enrollment',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull(),
    courseId: text('course_id').notNull(),
    releaseId: text('release_id').notNull(),
    startedAt: integer('started_at').notNull(),
    preparationAcknowledgedAt: integer('preparation_acknowledged_at'),
    revision: integer('revision').notNull().default(sql.raw('0')),
    lastOpenedItemId: text('last_opened_item_id'),
    lastOpenedAt: integer('last_opened_at'),
    resumeItemId: text('resume_item_id'),
    resumeAnchor: text('resume_anchor'),
    resumeUpdatedAt: integer('resume_updated_at'),
  },
  (table) => [
    unique('enrollment_id_release_id_unique').on(table.id, table.releaseId),
    unique('enrollment_user_id_course_id_unique').on(
      table.userId,
      table.courseId,
    ),
    foreignKey({
      columns: [table.resumeItemId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.lastOpenedItemId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.releaseId, table.courseId],
      foreignColumns: [courseRelease.id, courseRelease.courseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [appUser.id],
    }).onDelete('cascade'),
    check('enrollment_check_0', sql.raw('revision >= 0')),
  ],
);

export const userProgress = sqliteTable(
  'user_progress',
  {
    enrollmentId: text('enrollment_id').notNull(),
    releaseId: text('release_id').notNull(),
    lessonId: text('lesson_id').notNull(),
    status: text('status').notNull(),
    startedAt: integer('started_at').notNull(),
    completedAt: integer('completed_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.lessonId] }),
    foreignKey({
      columns: [table.lessonId],
      foreignColumns: [lesson.itemId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.lessonId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.enrollmentId, table.releaseId],
      foreignColumns: [enrollment.id, enrollment.releaseId],
    }).onDelete('cascade'),
    check(
      'user_progress_check_0',
      sql.raw("status IN ('started','completed')"),
    ),
    check(
      'user_progress_check_1',
      sql.raw(
        "(status='completed' AND completed_at IS NOT NULL) OR (status='started' AND completed_at IS NULL)",
      ),
    ),
  ],
);

export const exerciseProgress = sqliteTable(
  'exercise_progress',
  {
    enrollmentId: text('enrollment_id').notNull(),
    releaseId: text('release_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    status: text('status').notNull(),
    startedAt: integer('started_at').notNull(),
    completedAt: integer('completed_at'),
    criterionAttestedAt: integer('criterion_attested_at'),
    result: text('result'),
    evidenceText: text('evidence_text').notNull().default(sql.raw("''")),
    selectedScope: text('selected_scope').notNull().default(sql.raw("''")),
    rubricJson: text('rubric_json').notNull().default(sql.raw("'{}'")),
    revealedHintLevel: integer('revealed_hint_level')
      .notNull()
      .default(sql.raw('0')),
    solutionRevealedAt: integer('solution_revealed_at'),
    rewriteAttestedAt: integer('rewrite_attested_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.exerciseId] }),
    foreignKey({
      columns: [table.exerciseId],
      foreignColumns: [exercise.itemId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.exerciseId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.enrollmentId, table.releaseId],
      foreignColumns: [enrollment.id, enrollment.releaseId],
    }).onDelete('cascade'),
    check(
      'exercise_progress_check_0',
      sql.raw("status IN ('started','completed')"),
    ),
    check(
      'exercise_progress_check_1',
      sql.raw("result IN ('passed','needs_review')"),
    ),
    check('exercise_progress_check_2', sql.raw('json_valid(rubric_json)')),
    check(
      'exercise_progress_check_3',
      sql.raw('revealed_hint_level BETWEEN 0 AND 5'),
    ),
    check(
      'exercise_progress_check_4',
      sql.raw(
        "(status='completed' AND completed_at IS NOT NULL AND criterion_attested_at IS NOT NULL AND result IS NOT NULL AND result='passed' AND length(trim(evidence_text))>0) OR (status='started' AND completed_at IS NULL)",
      ),
    ),
  ],
);

export const taskProgress = sqliteTable(
  'task_progress',
  {
    enrollmentId: text('enrollment_id').notNull(),
    releaseId: text('release_id').notNull(),
    taskId: text('task_id').notNull(),
    status: text('status').notNull(),
    reason: text('reason').notNull().default(sql.raw("''")),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.taskId] }),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [exerciseTask.itemId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.taskId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.enrollmentId, table.releaseId],
      foreignColumns: [enrollment.id, enrollment.releaseId],
    }).onDelete('cascade'),
    check(
      'task_progress_check_0',
      sql.raw("status IN ('done','not_applicable')"),
    ),
    check(
      'task_progress_check_1',
      sql.raw("status!='not_applicable' OR length(trim(reason))>0"),
    ),
  ],
);

export const preparationProgress = sqliteTable(
  'preparation_progress',
  {
    enrollmentId: text('enrollment_id').notNull(),
    releaseId: text('release_id').notNull(),
    preparationItemId: text('preparation_item_id').notNull(),
    completedAt: integer('completed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.preparationItemId] }),
    foreignKey({
      columns: [table.preparationItemId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.enrollmentId, table.releaseId],
      foreignColumns: [enrollment.id, enrollment.releaseId],
    }).onDelete('cascade'),
  ],
);

export const note = sqliteTable(
  'note',
  {
    id: text('id').primaryKey().notNull(),
    enrollmentId: text('enrollment_id').notNull(),
    releaseId: text('release_id').notNull(),
    contentItemId: text('content_item_id').notNull(),
    bodyText: text('body_text').notNull().default(sql.raw("''")),
    revision: integer('revision').notNull().default(sql.raw('0')),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    unique('note_enrollment_id_content_item_id_unique').on(
      table.enrollmentId,
      table.contentItemId,
    ),
    foreignKey({
      columns: [table.contentItemId, table.releaseId],
      foreignColumns: [contentItem.id, contentItem.releaseId],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.enrollmentId, table.releaseId],
      foreignColumns: [enrollment.id, enrollment.releaseId],
    }).onDelete('cascade'),
  ],
);

export const scorecard = sqliteTable(
  'scorecard',
  {
    id: text('id').primaryKey().notNull(),
    enrollmentId: text('enrollment_id').notNull(),
    periodKey: text('period_key').notNull(),
    ratingsJson: text('ratings_json').notNull(),
    evidenceJson: text('evidence_json').notNull().default(sql.raw("'{}'")),
    revision: integer('revision').notNull().default(sql.raw('0')),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    unique('scorecard_enrollment_id_period_key_unique').on(
      table.enrollmentId,
      table.periodKey,
    ),
    foreignKey({
      columns: [table.enrollmentId],
      foreignColumns: [enrollment.id],
    }).onDelete('cascade'),
    check('scorecard_check_0', sql.raw('json_valid(ratings_json)')),
    check('scorecard_check_1', sql.raw('json_valid(evidence_json)')),
  ],
);

export const activityEvent = sqliteTable(
  'activity_event',
  {
    id: text('id').primaryKey().notNull(),
    enrollmentId: text('enrollment_id').notNull(),
    itemStableKey: text('item_stable_key'),
    type: text('type').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    payloadJson: text('payload_json').notNull().default(sql.raw("'{}'")),
  },
  (table) => [
    index('activity_event_enrollment_id_occurred_at_index').on(
      table.enrollmentId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.enrollmentId],
      foreignColumns: [enrollment.id],
    }).onDelete('cascade'),
    check(
      'activity_event_check_0',
      sql.raw(
        "type IN ('lesson_completed','lesson_reopened','exercise_completed','exercise_reopened','checkpoint_needs_review','day_completed','day_reopened','course_completed','course_reopened','release_migrated')",
      ),
    ),
    check('activity_event_check_1', sql.raw('json_valid(payload_json)')),
  ],
);

export const mutationReceipt = sqliteTable(
  'mutation_receipt',
  {
    enrollmentId: text('enrollment_id').notNull(),
    mutationId: text('mutation_id').notNull(),
    requestHash: text('request_hash').notNull(),
    responseJson: text('response_json').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.mutationId] }),
    foreignKey({
      columns: [table.enrollmentId],
      foreignColumns: [enrollment.id],
    }).onDelete('cascade'),
    check('mutation_receipt_check_0', sql.raw('json_valid(response_json)')),
  ],
);
