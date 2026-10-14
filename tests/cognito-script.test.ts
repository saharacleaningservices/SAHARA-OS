// Behavioural tests of the Apps Script bridge (docs/cognito-email-lead.gs) against mocked Google services.
// No network, no Google account, no real data. Run: npm run test:cognito
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = readFileSync(path.join(process.cwd(), "docs", "cognito-email-lead.gs"), "utf8");

type Thread = { id: string; body: string; labels: string[]; getMessages: () => { getPlainBody: () => string }[]; getId: () => string; addLabel: (l: { name: string }) => void };
type Fetch = { url: string; opts: { headers: Record<string, string>; payload: string } };

function mail(name: string, phone: string, subject = "Home cleaning", message = "hello") {
  return `Sahara Cleaning Form View full entry at CognitoForms.com. Entry Details Name ${name} Phone ${phone} Subject ${subject} Email x@example.com Message us ${message}`;
}

function harness(opts: { props?: Record<string, string>; bodies: string[]; responseCode?: number | ((n: number) => number); lockOk?: boolean }) {
  const props: Record<string, string> = { LEAD_URL: "https://crm.example/api/webhook/email-lead", LEAD_TOKEN: "unit-test-token-not-real", ...opts.props };
  const fetches: Fetch[] = [];
  const mails: { to: string; subject: string }[] = [];
  const created = new Set<string>();
  const threads: Thread[] = opts.bodies.map((body, i) => {
    const t: Thread = {
      id: `t${i}`,
      body,
      labels: [],
      getMessages: () => [{ getPlainBody: () => body }],
      getId: () => `t${i}`,
      addLabel: (l) => void t.labels.push(l.name),
    };
    return t;
  });
  let searchQuery = "";
  const mocks = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => void (props[k] = v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => opts.lockOk !== false, releaseLock: () => {} }) },
    GmailApp: {
      getUserLabelByName: (n: string) => (created.has(n) ? { name: n } : null),
      createLabel: (n: string) => (created.add(n), { name: n }),
      search: (q: string) => {
        searchQuery = q;
        return threads.filter((t) => !t.labels.includes("CRM-synced") && !t.labels.includes("CRM-skipped"));
      },
    },
    UrlFetchApp: {
      fetch: (url: string, o: Fetch["opts"]) => {
        fetches.push({ url, opts: o });
        const code = typeof opts.responseCode === "function" ? opts.responseCode(fetches.length) : (opts.responseCode ?? 200);
        return { getResponseCode: () => code };
      },
    },
    MailApp: { sendEmail: (to: string, subject: string) => void mails.push({ to, subject }) },
    Session: { getActiveUser: () => ({ getEmail: () => "owner@example.com" }) },
    Utilities: { formatDate: () => "2026-10-14" },
    console: { log: () => {}, error: () => {} },
  };
  const api = new Function(...Object.keys(mocks), `${SRC}\nreturn { processCognitoEmails, parseCognito };`)(...Object.values(mocks)) as {
    processCognitoEmails: () => void;
    parseCognito: (b: string) => { name: string; mobile: string; service: string; email: string; message: string; source: string };
  };
  return { api, props, fetches, mails, threads, query: () => searchQuery };
}

test("parser: name, phone, service, email, message from a Cognito notification; +91 and spaces kept for the CRM to normalise", () => {
  const { api } = harness({ bodies: [] });
  const p = api.parseCognito(mail("Asha Patil", "+91 98200 11111", "Deep cleaning of 2 bhk", "Need Sunday morning"));
  assert.equal(p.name, "Asha Patil");
  assert.equal(p.mobile, "+919820011111");
  assert.equal(p.service, "Deep cleaning of 2 bhk");
  assert.equal(p.email, "x@example.com");
  assert.equal(p.message, "Need Sunday morning");
  assert.equal(p.source, "Cognito Form");
  assert.equal(api.parseCognito("Entry Details Name A Subject B").mobile, "", "no phone => empty, handled by the caller");
});

test("success: each thread is posted once with the Bearer token and then labelled CRM-synced; the next run sends nothing", () => {
  const h = harness({ bodies: [mail("A One", "9820011111"), mail("B Two", "9820022222")] });
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, 2);
  assert.equal(h.fetches[0].url, h.props.LEAD_URL);
  assert.equal(h.fetches[0].opts.headers.Authorization, "Bearer unit-test-token-not-real");
  assert.ok(h.threads.every((t) => t.labels.includes("CRM-synced")));
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, 2, "already-synced threads are never re-sent (duplicate protection on the script side)");
  assert.match(h.query(), /newer_than:14d/);
  assert.match(h.query(), /-label:CRM-synced -label:CRM-skipped/);
  assert.match(h.query(), /from:notifications@cognitoforms\.com/);
});

test("CRM failure: not labelled (so it is retried), owner e-mailed once per day, no duplicates after recovery", () => {
  let healthy = false;
  const h = harness({ bodies: [mail("A One", "9820011111"), mail("B Two", "9820022222")], responseCode: () => (healthy ? 200 : 500) });
  h.api.processCognitoEmails();
  assert.ok(h.threads.every((t) => t.labels.length === 0), "failed threads stay unlabelled");
  assert.equal(h.mails.length, 1);
  assert.match(h.mails[0].subject, /2 Cognito enquiry\(ies\) could not reach the CRM/);
  h.api.processCognitoEmails();
  assert.equal(h.mails.length, 1, "at most one alert e-mail per day");
  healthy = true;
  h.api.processCognitoEmails();
  assert.ok(h.threads.every((t) => t.labels.includes("CRM-synced")), "retried and delivered once the CRM is back");
  const before = h.fetches.length;
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, before);
});

test("a mail without a usable phone number is labelled CRM-skipped, never posted and not retried forever", () => {
  const h = harness({ bodies: ["Entry Details Name Nobody Subject Just a question Email n@example.com Message us hi", mail("Short", "12345")] });
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, 0);
  assert.ok(h.threads.every((t) => t.labels.includes("CRM-skipped")));
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, 0);
});

test("DRY_RUN: nothing is posted, nothing is labelled, nothing is e-mailed — even with no token set", () => {
  const h = harness({ props: { DRY_RUN: "true", LEAD_TOKEN: "" }, bodies: [mail("A One", "9820011111"), "no phone here"], responseCode: 500 });
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, 0);
  assert.ok(h.threads.every((t) => t.labels.length === 0));
  assert.equal(h.mails.length, 0);
});

test("configuration: missing LEAD_URL or LEAD_TOKEN stops the run with a clear error and posts nothing", () => {
  const noToken = harness({ props: { LEAD_TOKEN: "" }, bodies: [mail("A", "9820011111")] });
  assert.throws(() => noToken.api.processCognitoEmails(), /Set LEAD_URL and LEAD_TOKEN/);
  const noUrl = harness({ props: { LEAD_URL: "" }, bodies: [mail("A", "9820011111")] });
  assert.throws(() => noUrl.api.processCognitoEmails(), /Set LEAD_URL and LEAD_TOKEN/);
  assert.equal(noToken.fetches.length + noUrl.fetches.length, 0);
});

test("overlapping runs: if the lock is held the run exits without touching Gmail or the CRM", () => {
  const h = harness({ lockOk: false, bodies: [mail("A", "9820011111")] });
  h.api.processCognitoEmails();
  assert.equal(h.fetches.length, 0);
  assert.equal(h.threads[0].labels.length, 0);
});

test("the token never appears in the script source or in the e-mails it sends", () => {
  assert.doesNotMatch(SRC, /Bearer (?!EMAIL_LEAD_TOKEN)[A-Za-z0-9_\-]{16,}/);
  const h = harness({ bodies: [mail("A", "9820011111")], responseCode: 500 });
  h.api.processCognitoEmails();
  assert.ok(!JSON.stringify(h.mails).includes("unit-test-token-not-real"));
});
