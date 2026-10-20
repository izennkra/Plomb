/** Runs `task` on every item, at most `limit` at a time, and returns the results in the items' order. */
export async function mapInParallel<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (let index = next++; index < items.length; index = next++) results[index] = await task(items[index]);
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
