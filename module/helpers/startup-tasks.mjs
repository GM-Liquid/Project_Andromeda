/**
 * Run named startup work in a deterministic order. Independent tasks may opt into
 * continuing after failure; migration chains stop by default so later steps never
 * run against a partially migrated world.
 */
export async function runStartupTasks(tasks = [], { onError } = {}) {
  const results = [];

  for (const task of tasks) {
    const name = String(task?.name ?? '').trim() || 'unnamed startup task';
    try {
      const value = await task.run();
      results.push({ name, status: 'fulfilled', value });
    } catch (error) {
      results.push({ name, status: 'rejected', error });
      await onError?.({ name, error });
      if (!task.continueOnError) throw error;
    }
  }

  return results;
}
