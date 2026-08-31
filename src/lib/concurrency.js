/**
 * Run async task factories with a max concurrency limit.
 * Returns results in the same order as tasks.
 */
export async function runConcurrent(tasks, concurrency) {
  if (!tasks.length) return [];

  const results = new Array(tasks.length);
  let index = 0;

  async function runNext() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, runNext),
  );

  return results;
}
