import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
function client() {
  const cookies = new Map();
  return async (route, body, expected = 200, method = 'POST') => {
    const cookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const remember = (response) => {
      for (const value of response.headers.getSetCookie()) {
        const [pair] = value.split(';');
        const at = pair.indexOf('=');
        cookies.set(pair.slice(0, at), pair.slice(at + 1));
      }
    };
    const csrfResponse = await fetch(config.origin + '/api/auth/csrf', {
      headers: { cookie: cookie() },
    });
    remember(csrfResponse);
    const csrf = await csrfResponse.json();
    const response = await fetch(config.origin + route, {
      method,
      redirect: 'manual',
      headers: {
        cookie: cookie(),
        origin: config.origin,
        'content-type': 'application/json',
        'x-csrf-token': csrf.data.token,
      },
      body: JSON.stringify(body),
    });
    remember(response);
    if (response.status !== expected) {
      const diagnostic = await response.json();
      throw new Error(
        route + ': ' + response.status + ' ' + JSON.stringify(diagnostic.error),
      );
    }
    return response.status === 204 ? null : response.json();
  };
}
const first = client();
const second = client();
const email = `exercise-http-${randomUUID()}@example.test`;
const password = randomUUID() + randomUUID();
await first(
  '/api/auth/register',
  { email, password, confirmation: password },
  201,
);
await first('/api/auth/login', { email, password });
const initial = await first('/api/enrollment', {});
assert.equal(initial.data.enrollment.releaseId, 'se-26w-v1');
const submission = {
  tasks: [],
  evidence: '',
  selectedScope: '',
  attested: false,
  result: 'needs_review',
  transferPath: null,
  transferReflection: '',
  scoreEvidence: '6/10, two of three problems solved',
  remediationNote: 'Repeat Days 3–5, then retry all three problems',
};
const input = {
  kind: 'exercise',
  itemId: 'se-26w-v1:d007-practice',
  completed: false,
  expectedRevision: initial.data.revision,
  mutationId: randomUUID(),
  submission,
};
const route = '/api/progress/exercises/' + encodeURIComponent(input.itemId);
const saved = await first(route, input, 200, 'PUT');
assert.equal(saved.data.completed, 0);
assert.equal(saved.data.exerciseProgress[0].status, 'started');
assert.deepEqual(saved.data.exerciseProgress[0].submission, submission);
assert.deepEqual(await first(route, input, 200, 'PUT'), saved);
await first(
  route,
  {
    ...input,
    mutationId: randomUUID(),
    expectedRevision: saved.data.revision,
    completed: true,
  },
  422,
  'PUT',
);
await first('/api/auth/logout', {}, 204);
await first('/api/auth/login', { email, password });
assert.deepEqual((await first('/api/enrollment', {})).data, saved.data);
const otherEmail = `assessment-other-${randomUUID()}@example.test`;
await second(
  '/api/auth/register',
  { email: otherEmail, password, confirmation: password },
  201,
);
await second('/api/auth/login', { email: otherEmail, password });
const other = await second('/api/enrollment', {});
assert.deepEqual(other.data.exerciseProgress, []);
assert.equal(other.data.completed, 0);
await first('/api/auth/logout', {}, 204);
await second('/api/auth/logout', {}, 204);
const report = {
  date: new Date().toISOString(),
  server: 'development',
  saveReviewWithoutCredit: 'passed',
  retry: 'passed',
  forgedCompletion: 'rejected',
  loginReloadPersistence: 'passed',
  twoUsers: 'isolated',
};
await writeFile(
  path.join(root, 'docs/m4-step4-http-audit.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(report);
