import { environment } from './environment.mjs';
try {
  environment();
  const { checkNativeDependencies } = await import('./native-check.mjs');
  console.log(await checkNativeDependencies());
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Dependency check failed.',
  );
  console.error(
    'See README: native dependency troubleshooting. Student databases were not changed.',
  );
  process.exitCode = 1;
}
