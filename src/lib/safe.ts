export type Result<T> = { ok: true; data: T } | { ok: false; error: unknown };

/**
 * Runs a server data loader and captures failures, so one unavailable section
 * (e.g. the database is down) renders an error state instead of failing the page.
 */
export async function safely<T>(load: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(JSON.stringify({ level: "error", msg: "server data loader failed", error: String(error) }));
    }
    return { ok: false, error };
  }
}
