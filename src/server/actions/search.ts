"use server";

import { getSession } from "@/lib/session";
import { canSearchGlobally } from "@/lib/permissions";
import { globalSearch, type SearchResult } from "@/server/search";

export async function runGlobalSearch(query: string): Promise<{ results: SearchResult[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  if (!canSearchGlobally(session.role)) return { error: "Not available for your role" };
  const results = await globalSearch(query);
  return { results };
}
