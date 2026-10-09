/** Customer-facing message when a server action throws or the network drops (never shows internals). */
export const SUBMIT_FAILED_MESSAGE =
  "We couldn't send your request just now. Please check your connection and try again — if it keeps failing, call us on 8956567130 / 7083347130.";

/**
 * Awaits a server action and converts a thrown error into `{ error }` so forms show a
 * retry message instead of crashing to Next's generic error page. Never reports success.
 */
export async function safely<T extends object>(action: Promise<T>): Promise<T | { error: string }> {
  try {
    return await action;
  } catch {
    return { error: SUBMIT_FAILED_MESSAGE };
  }
}
