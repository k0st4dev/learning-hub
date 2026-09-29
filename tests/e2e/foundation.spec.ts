import { test } from '@playwright/test';
import {
  verifyFoundation,
  verifyBoundaries,
  viewports,
} from './foundation-checks';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const viewport of viewports) {
    test(`foundation ${viewport.width}px ${colorScheme}`, async ({
      page,
      baseURL,
    }) => {
      await verifyFoundation(page, baseURL!, viewport, colorScheme);
    });
  }
}
test('helpful 404 and rejected foreign origins/hosts', async ({
  page,
  baseURL,
}) => {
  await verifyBoundaries(page, baseURL!);
});
