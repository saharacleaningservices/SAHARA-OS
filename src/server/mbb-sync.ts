// MyBillBook full-history sync — database side (owner 2026-11-06). Admin-only entry: src/app/api/admin/mbb-sync/route.ts.
// Re-runnable: customers are keyed by mobile, history rows by key — nothing is ever stored twice. dryRun writes nothing.
import { db } from "@/lib/db";
import { isProtectedNumber } from "@/lib/protected-numbers";
import { createWithCustomerNumber, normalizeMobile } from "@/server/customer-db";
import { decideParty, docTypeOf, mergeSegment, segmentOf, statusOf, type PartyDecision } from "@/lib/mbb-sync";

export type SyncVoucher = { id: string; date: string; type: string; sn: string | null; amt: string | number | null; tot: string | number | null; rem: string | number | null; pm?: string | null };
export type SyncMember = { src: "P" | "S"; id: string; name: string; gstin?: string | null; deleted?: boolean };
export type SyncParty = { mobile: string; members: SyncMember[]; vouchers: (SyncVoucher & { src: "P" | "S" })[] };

export type SyncTotals = {
  parties: number;
  decisions: Record<PartyDecision, number>;
  customersCreated: number;
  invoicesCreated: number;
  invoicesUpdated: number;
  invoicesUnchanged: number;
  invoicesClosedPaid: number;
  reviewItemsCreated: number;
  skippedNoGst: number;
};

export const emptyTotals = (): SyncTotals => ({
  parties: 0,
  decisions: { CREATE_AND_ATTACH: 0, ATTACH: 0, NAME_CONFLICT: 0, PARTIAL_MATCH: 0, MULTI_PARTY: 0, NEW_MULTI_PARTY: 0, INVALID_MOBILE: 0, PROTECTED: 0 },
  customersCreated: 0, invoicesCreated: 0, invoicesUpdated: 0, invoicesUnchanged: 0, invoicesClosedPaid: 0, reviewItemsCreated: 0, skippedNoGst: 0,
});

const n = (v: string | number | null | undefined) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };
const datasetOf = (src: "P" | "S") => (src === "S" ? ("GST" as const) : ("B2C" as const));
const noon = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00+05:30`);

export async function syncParties(parties: SyncParty[], opts: { dryRun: boolean; batchId: string; actor: string }): Promise<SyncTotals> {
  const t = emptyTotals();
  const mobiles = parties.map((p) => normalizeMobile(p.mobile)).filter((m): m is string => !!m);
  const customers = new Map((await db.customer.findMany({ where: { mobile: { in: mobiles } }, select: { id: true, mobile: true, name: true, segment: true, gstin: true } })).map((c) => [c.mobile, c]));
  const serials = parties.flatMap((p) => p.vouchers.filter((v) => v.type === "sales_invoice" && v.sn).map((v) => v.sn as string));
  const existingBySerial = new Map<string, { id: string; status: string; remaining: number; amount: number; customerId: string | null }>();
  if (serials.length) {
    for (const r of await db.mybillbookInvoice.findMany({ where: { invoiceNo: { in: serials } }, select: { id: true, invoiceNo: true, dataset: true, status: true, remaining: true, amount: true, customerId: true } }))
      existingBySerial.set(`${r.dataset}|${r.invoiceNo}`, r);
  }
  const keys = parties.flatMap((p) => p.vouchers.map((v) => `mbbv:${datasetOf(v.src)}:${v.id}`));
  const existingByKey = new Map((await db.mybillbookInvoice.findMany({ where: { invoiceKey: { in: keys } }, select: { id: true, invoiceKey: true, status: true, remaining: true, amount: true } })).map((r) => [r.invoiceKey, r]));

  for (const p of parties) {
    t.parties += 1;
    const mobile = normalizeMobile(p.mobile);
    const crm = mobile ? customers.get(mobile) ?? null : null;
    const decision = decideParty({ mobileValid: !!mobile, protectedNumber: isProtectedNumber(p.mobile), memberCount: p.members.length, crmName: crm ? crm.name : null, mbbNames: p.members.map((m) => m.name) });
    t.decisions[decision] += 1;
    const datasets = [...new Set(p.members.map((m) => datasetOf(m.src)))];
    const dsLabel = datasets.length > 1 ? "BOTH" : datasets[0] ?? "B2C";

    if (decision === "PROTECTED") continue;
    if (decision !== "CREATE_AND_ATTACH" && decision !== "ATTACH") {
      // Review-queue party: never attach or create anything, but keep invoices the CRM already holds in step with
      // MyBillBook (Paid / remaining), matched by serial or voucher key only — so the ledger has zero variance while
      // the party itself waits for a human decision.
      for (const v of p.vouchers) {
        const ds = datasetOf(v.src);
        const doc = docTypeOf(v.type);
        const old = (doc === "SALES_INVOICE" && v.sn ? existingBySerial.get(`${ds}|${v.sn}`) : undefined) ?? existingByKey.get(`mbbv:${ds}:${v.id}`);
        if (!old) continue;
        const rem = n(v.rem);
        const amount = n(v.tot) || n(v.amt);
        const status = statusOf(doc, rem);
        if (old.status === status && Math.abs(old.remaining - rem) <= 0.005 && Math.abs(old.amount - amount) <= 0.005) { t.invoicesUnchanged += 1; continue; }
        t.invoicesUpdated += 1;
        if (old.status !== "Paid" && status === "Paid") t.invoicesClosedPaid += 1;
        if (!opts.dryRun) await db.mybillbookInvoice.update({ where: { id: old.id }, data: { status, remaining: rem, amount, importBatchId: opts.batchId } });
      }
      t.reviewItemsCreated += 1;
      if (opts.dryRun) continue;
      const already = await db.mybillbookReviewItem.findFirst({ where: { mobile: mobile ?? p.mobile, kind: decision, status: "OPEN" }, select: { id: true } });
      if (already) { t.reviewItemsCreated -= 1; continue; }
      await db.mybillbookReviewItem.create({ data: {
        kind: decision, mobile: mobile ?? p.mobile, dataset: dsLabel, crmCustomerId: crm?.id ?? null, crmName: crm?.name ?? null,
        mbbNames: JSON.stringify(p.members.map((m) => m.name)), txnCount: p.vouchers.length, importBatchId: opts.batchId,
        detailJson: JSON.stringify({ members: p.members, vouchers: p.vouchers }),
      } });
      continue;
    }

    // Perfect match (or a brand-new single party): history may be attached.
    const member = p.members[0];
    const incomingSeg = segmentOf(datasetOf(member.src));
    const gstin = (member.gstin ?? "").trim() || null;
    let customerId = crm?.id ?? null;
    if (decision === "CREATE_AND_ATTACH") {
      t.customersCreated += 1;
      if (!opts.dryRun) {
        const c = await createWithCustomerNumber((customerNumber) => ({ name: member.name.trim().slice(0, 120) || "Customer", mobile: mobile as string, customerNumber, source: "MyBillBook", notes: "Created from MyBillBook full-history sync", segment: incomingSeg, gstin }));
        customerId = c.id;
      }
    } else if (!opts.dryRun && crm) {
      const seg = mergeSegment(crm.segment, incomingSeg);
      const patch: { segment?: string; gstin?: string } = {};
      if (seg !== crm.segment) patch.segment = seg;
      if (gstin && !crm.gstin) patch.gstin = gstin;
      if (Object.keys(patch).length) await db.customer.update({ where: { id: crm.id }, data: patch });
    }

    for (const v of p.vouchers) {
      const ds = datasetOf(v.src);
      const doc = docTypeOf(v.type);
      const rem = n(v.rem);
      const amount = n(v.tot) || n(v.amt);
      const status = statusOf(doc, rem);
      const old = (doc === "SALES_INVOICE" && v.sn ? existingBySerial.get(`${ds}|${v.sn}`) : undefined) ?? existingByKey.get(`mbbv:${ds}:${v.id}`);
      if (old) {
        const changed = old.status !== status || Math.abs(old.remaining - rem) > 0.005 || Math.abs(old.amount - amount) > 0.005;
        if (!changed) { t.invoicesUnchanged += 1; continue; }
        t.invoicesUpdated += 1;
        if (old.status !== "Paid" && status === "Paid") t.invoicesClosedPaid += 1;
        if (!opts.dryRun) await db.mybillbookInvoice.update({ where: { id: old.id }, data: { status, remaining: rem, amount, importBatchId: opts.batchId } });
        continue;
      }
      t.invoicesCreated += 1;
      if (opts.dryRun) continue;
      await db.mybillbookInvoice.create({ data: {
        invoiceKey: `mbbv:${ds}:${v.id}`, invoiceNo: v.sn || v.id.slice(0, 8), invoiceDate: noon(v.date), contactName: member.name.slice(0, 160),
        amount, remaining: rem, status, invoiceLink: "", paymentType: v.pm || null, customerId, matchStatus: "MATCHED", matchMethod: "PHONE",
        importBatchId: opts.batchId, detailStatus: "DONE", partyMobile: mobile, dataset: ds, gstin, docType: doc,
      } });
    }
  }
  return t;
}

/**
 * Zero-variance check on the synced history: what MyBillBook says is paid / remaining, versus what the CRM now holds,
 * for the sales invoices of these parties. Every mismatch lists all CRM rows that could stand for that invoice (same
 * voucher key, or same serial in the same book), so duplicates and cross-book serial clashes are visible.
 */
export async function varianceCheck(parties: SyncParty[]) {
  let mbbPaid = 0, crmPaid = 0, rows = 0;
  const mismatches: { mobile: string; sn: string | null; book: string; mbb: { tot: number; rem: number }; crm: { key: string; no: string; dataset: string; amount: number; remaining: number; status: string; customerId: string | null }[] }[] = [];
  for (const p of parties) {
    for (const v of p.vouchers) {
      if (v.type !== "sales_invoice") continue;
      const ds = datasetOf(v.src);
      const key = `mbbv:${ds}:${v.id}`;
      const select = { invoiceKey: true, invoiceNo: true, dataset: true, amount: true, remaining: true, status: true, customerId: true } as const;
      const byKey = await db.mybillbookInvoice.findUnique({ where: { invoiceKey: key }, select });
      const bySerial = v.sn ? await db.mybillbookInvoice.findMany({ where: { invoiceNo: v.sn, dataset: ds }, select }) : [];
      // The voucher's own row wins; otherwise the single serial match.
      const row = byKey ?? (bySerial.length === 1 ? bySerial[0] : bySerial[0] ?? null);
      if (!row) continue;
      rows += 1;
      const mPaid = n(v.tot) - n(v.rem);
      const cPaid = row.amount - row.remaining;
      mbbPaid += mPaid;
      crmPaid += cPaid;
      if (Math.abs(mPaid - cPaid) > 0.005 && mismatches.length < 25) {
        const all = new Map([...(byKey ? [byKey] : []), ...bySerial].map((r) => [r.invoiceKey, r]));
        mismatches.push({
          mobile: p.mobile, sn: v.sn, book: ds, mbb: { tot: n(v.tot), rem: n(v.rem) },
          crm: [...all.values()].map((r) => ({ key: r.invoiceKey.slice(0, 60), no: r.invoiceNo, dataset: r.dataset, amount: r.amount, remaining: r.remaining, status: r.status, customerId: r.customerId })),
        });
      }
    }
  }
  return { rows, mbbPaid: Math.round(mbbPaid * 100) / 100, crmPaid: Math.round(crmPaid * 100) / 100, variance: Math.round((mbbPaid - crmPaid) * 100) / 100, mismatches };
}
