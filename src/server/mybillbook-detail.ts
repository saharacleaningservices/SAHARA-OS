// Reads the service details of every imported MyBillBook invoice from its shared link and attaches the invoice to a customer by the
// mobile number printed on it (owner 2026-10-23). No login, OTP or password: the shared link is public. Not a "use server" module —
// the Admin-only entry points are in src/server/actions/mybillbook-import.ts.
//
// Gentle by design: three requests at a time with a pause after each, stops by itself if MyBillBook starts refusing, and every result
// is saved as it arrives so a restart or a pause loses nothing (a PENDING row is simply picked up next time).
import { db } from "@/lib/db";
import {
  decideLinkByPhone,
  detailAgreesWithRow,
  embedRequest,
  extractInvoicePayload,
  linkIdOf,
  parseInvoiceDetail,
  serviceLabel,
} from "@/lib/mybillbook-detail";
import { ensureCustomer, normalizeMobile } from "@/server/customer-db";

export type DetailRunState = { running: boolean; startedAt: number | null; total: number; processed: number; done: number; created: number; failed: number; mismatch: number; stopReason: string | null; stopRequested: boolean };

const g = globalThis as unknown as { __mbbDetailRun?: DetailRunState };
const fresh = (): DetailRunState => ({ running: false, startedAt: null, total: 0, processed: 0, done: 0, created: 0, failed: 0, mismatch: 0, stopReason: null, stopRequested: false });
export const detailRunState = (): DetailRunState => (g.__mbbDetailRun ??= fresh());

export async function detailCounts() {
  const rows = await db.mybillbookInvoice.groupBy({ by: ["detailStatus"], _count: { _all: true } });
  const n = Object.fromEntries(rows.map((r) => [r.detailStatus, r._count._all]));
  return { pending: n.PENDING ?? 0, done: n.DONE ?? 0, failed: n.FAILED ?? 0, mismatch: n.MISMATCH ?? 0 };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const breathe = () => new Promise<void>((resolve) => setImmediate(resolve));

class Transient extends Error {}

type Options = { retryFailed?: boolean; fetchImpl?: typeof fetch; delayMs?: number; concurrency?: number; maxRows?: number };

/** Starts the background read. Returns at once; `finished` resolves when the run ends (tests await it, the app ignores it). */
export function startDetailFetch(opts: Options = {}): { started: boolean; reason?: string; finished: Promise<void> } {
  const state = detailRunState();
  if (state.running) return { started: false, reason: "Already running", finished: Promise.resolve() };
  Object.assign(state, fresh(), { running: true, startedAt: Date.now() });
  const finished = run(state, opts)
    .catch((e) => {
      state.stopReason = `Stopped: ${e instanceof Error ? e.message : "unexpected error"}`;
    })
    .finally(() => {
      state.running = false;
    });
  return { started: true, finished };
}

export function stopDetailFetch() {
  detailRunState().stopRequested = true;
}

async function run(state: DetailRunState, opts: Options) {
  const doFetch = opts.fetchImpl ?? fetch;
  const delay = opts.delayMs ?? 250;
  const workers = Math.max(1, Math.min(opts.concurrency ?? 3, 5));
  const statuses = opts.retryFailed ? ["PENDING", "FAILED"] : ["PENDING"];
  const todo = await db.mybillbookInvoice.findMany({
    where: { detailStatus: { in: statuses } },
    orderBy: { invoiceDate: "desc" },
    select: { id: true },
    ...(opts.maxRows ? { take: opts.maxRows } : {}),
  });
  state.total = todo.length;
  const customerByMobile = new Map((await db.customer.findMany({ select: { id: true, mobile: true } })).map((c) => [normalizeMobile(c.mobile) ?? c.mobile, c.id]));

  let next = 0;
  let transientStreak = 0;
  const worker = async () => {
    while (!state.stopRequested && !state.stopReason) {
      const at = next++;
      if (at >= todo.length) return;
      const row = await db.mybillbookInvoice.findUnique({ where: { id: todo[at].id } });
      if (!row || !statuses.includes(row.detailStatus)) continue;
      try {
        await readOne(row, doFetch, customerByMobile, state);
        transientStreak = 0;
      } catch (e) {
        if (e instanceof Transient) {
          // Not the invoice's fault (network / MyBillBook busy): leave it PENDING, and stop the run if it keeps happening.
          if (++transientStreak >= 5) state.stopReason = `Paused: MyBillBook is not answering (${e.message}). Start again later — nothing was lost.`;
        } else {
          throw e;
        }
      }
      state.processed += 1;
      await breathe();
      await sleep(delay);
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  await db.auditLog
    .create({ data: { entityType: "MybillbookImport", entityId: "detail-fetch", action: "FETCH", summary: `MyBillBook invoice details read: ${state.done} ok, ${state.created} new customers, ${state.mismatch} mismatch, ${state.failed} failed of ${state.processed} tried`, actorName: "System" } })
    .catch(() => {});
}

type Row = NonNullable<Awaited<ReturnType<typeof db.mybillbookInvoice.findUnique>>>;

async function readOne(row: Row, doFetch: typeof fetch, customerByMobile: Map<string, string>, state: DetailRunState) {
  const fail = async (status: "FAILED" | "MISMATCH", error: string, extra: Record<string, unknown> = {}) => {
    await db.mybillbookInvoice.update({ where: { id: row.id }, data: { detailStatus: status, detailError: error.slice(0, 300), detailFetchedAt: new Date(), ...extra } });
    if (status === "FAILED") state.failed += 1;
    else state.mismatch += 1;
  };
  const id = linkIdOf(row.invoiceKey);
  if (!id) return fail("FAILED", "The invoice link has no usable id");

  const req = embedRequest(id);
  let res: Response;
  try {
    res = await doFetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new Transient(e instanceof Error ? e.message.slice(0, 80) : "network error");
  }
  if (res.status === 429 || res.status >= 500) throw new Transient(`HTTP ${res.status}`);
  if (res.status === 404 || res.status === 410) return fail("FAILED", "MyBillBook no longer has this invoice link");
  if (!res.ok) return fail("FAILED", `MyBillBook answered HTTP ${res.status}`);

  const payload = extractInvoicePayload(await res.text());
  if (!payload) return fail("FAILED", "The page did not contain an invoice");
  const detail = parseInvoiceDetail(payload);
  if (!detail) return fail("FAILED", "The invoice could not be read");

  if (!detailAgreesWithRow(detail, row)) {
    // The link now shows a different invoice (or a changed total). Keep what was read for an admin, but attach and rename nothing.
    return fail("MISMATCH", `Page shows ${detail.invoiceNumber} for ₹${detail.total}; the report has ${row.invoiceNo} for ₹${row.amount}`, { detailJson: JSON.stringify(detail), partyMobile: detail.partyMobile, partyAddress: detail.partyAddress });
  }

  let phoneCustomer = detail.partyMobile ? (customerByMobile.get(detail.partyMobile) ?? null) : null;
  // Owner 2026-10-23: a number the CRM has never seen becomes a new customer with this history — no invoice is left behind. Only for an
  // invoice that is still unmatched and has no same-name customer to choose from (those stay on the review list), and never for a row
  // without a valid mobile (it stays stored and listed for review). A new customer is NOT opted in to promotions.
  let created = false;
  if (!phoneCustomer && detail.partyMobile && row.matchStatus === "UNMATCHED" && !row.customerId) {
    const c = await ensureCustomer({
      mobile: detail.partyMobile,
      name: detail.partyName || row.contactName,
      address: detail.partyAddress,
      contactType: detail.partyGstin ? "CORPORATE" : "CUSTOMER",
      isRepeat: true,
      source: "MYBILLBOOK_IMPORT",
    });
    if (c) {
      phoneCustomer = c.id;
      customerByMobile.set(detail.partyMobile, c.id);
      created = true;
      state.created += 1;
    }
  }
  const decision = decideLinkByPhone({ matchStatus: row.matchStatus, matchMethod: row.matchMethod, customerId: row.customerId }, phoneCustomer);
  const link =
    decision.action === "attach"
      ? { customerId: decision.customerId, matchStatus: "MATCHED", matchMethod: created ? "AUTO_CREATED" : "PHONE", candidateIds: null }
      : decision.action === "review"
        ? { customerId: null, matchStatus: "REVIEW", matchMethod: null, candidateIds: JSON.stringify(decision.candidateIds) }
        : {};
  await db.mybillbookInvoice.update({
    where: { id: row.id },
    data: {
      detailStatus: "DONE",
      detailError: null,
      detailFetchedAt: new Date(),
      detailJson: JSON.stringify(detail),
      partyMobile: detail.partyMobile,
      partyAddress: detail.partyAddress,
      serviceName: serviceLabel(detail.lines) ?? row.serviceName,
      ...link,
    },
  });
  if (decision.action === "attach" && detail.invoiceDate) {
    const when = new Date(`${detail.invoiceDate}T06:30:00Z`);
    await db.customer.updateMany({ where: { id: decision.customerId, OR: [{ lastServiceDate: null }, { lastServiceDate: { lt: when } }] }, data: { lastServiceDate: when } });
  }
  state.done += 1;
}
