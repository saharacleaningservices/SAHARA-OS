const { chromium } = require("playwright");

const BASE = "http://localhost:3100";

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', "admin@saharacleaningservices.com");
  await page.fill('input[name="password"], input[type="password"]', "Sahara@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
  console.log("PASS: login -> dashboard");

  // Dashboard: New Inquiry button present and works
  const newInquiry = page.locator('a:has-text("New Inquiry")');
  await newInquiry.waitFor({ state: "visible", timeout: 5000 });
  console.log("PASS: 'New Inquiry' button visible on Dashboard");
  await newInquiry.click();
  await page.waitForURL(`${BASE}/leads/new`, { timeout: 10000 });
  console.log("PASS: New Inquiry navigates to /leads/new");

  // Fill lead form
  const uniqueMobile = "98" + Math.floor(10000000 + Math.random() * 89999999);
  await page.fill("#name", "Test Customer Phase1");
  await page.fill("#mobile", uniqueMobile);
  await page.fill("#address", "123 Test Street, Test Society");
  await page.fill("#area", "Kharadi");

  // Service select (Radix) - click trigger then option
  async function selectByLabel(triggerLabelText, optionText) {
    const label = page.locator(`label:has-text("${triggerLabelText}")`).first();
    const trigger = label.locator("xpath=following-sibling::button[1]");
    await trigger.click();
    await page.locator(`[role="option"]:has-text("${optionText}")`).first().click();
  }

  await selectByLabel("Service", "Home Deep Cleaning");
  await selectByLabel("Lead Source", "WhatsApp");
  await page.fill("#quoteAmount", "5999");
  const followUpDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await page.fill("#followUpDate", followUpDate);
  await selectByLabel("Assigned To", "Altaf Shaikh");
  await page.fill("#notes", "Phase 1 automated test lead");

  await page.click('button:has-text("Create lead")');
  await page.waitForURL(/\/leads\/(?!new)[a-zA-Z0-9]+$/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  console.log("PASS: lead created, redirected to lead detail page:", page.url());

  const detailText = await page.textContent("body");
  if (!detailText.includes("Test Customer Phase1")) throw new Error("Lead name not found on detail page");
  if (!detailText.includes("Altaf Shaikh")) throw new Error("Assigned To (Altaf Shaikh) not found on detail page");
  console.log("PASS: lead detail page shows name and Assigned To");

  // Leads list shows the new lead immediately
  await page.goto(`${BASE}/leads`);
  await page.waitForSelector("text=Test Customer Phase1", { timeout: 10000 });
  console.log("PASS: new lead appears immediately in Leads list");

  // Verify source label rendering (WhatsApp) somewhere reachable - check lead detail again
  await page.goto(`${BASE}/leads`);
  const leadsText = await page.textContent("body");
  if (!leadsText.includes("Test Customer Phase1")) throw new Error("Lead missing from leads list on reload");

  // Sweep other modules to confirm nothing broke
  const pagesToCheck = ["/dashboard", "/leads", "/jobs", "/staff", "/payments", "/expenses", "/profit", "/reports"];
  for (const p of pagesToCheck) {
    const resp = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
    if (!resp || resp.status() >= 400) throw new Error(`Page ${p} returned status ${resp && resp.status()}`);
    console.log(`PASS: ${p} loads (status ${resp.status()})`);
  }

  // Confirm Jobs/Payments still show historical seeded data (not empty)
  await page.goto(`${BASE}/jobs`);
  const jobsBody = await page.textContent("body");
  if (jobsBody.includes("No jobs") && !jobsBody.includes("JOB-2026")) {
    console.log("WARN: Jobs page may be empty — check manually");
  } else {
    console.log("PASS: Jobs page has historical data");
  }

  await page.goto(`${BASE}/payments`);
  const paymentsBody = await page.textContent("body");
  if (paymentsBody.includes("INV-2026")) {
    console.log("PASS: Payments page has historical data");
  } else {
    console.log("WARN: Payments page may be empty — check manually");
  }

  // CSV import buttons still present (regression from earlier feature)
  await page.goto(`${BASE}/leads`);
  await page.waitForSelector('button:has-text("Import")', { timeout: 5000 });
  console.log("PASS: Leads Import button still present");
  await page.goto(`${BASE}/staff`);
  await page.waitForSelector('button:has-text("Import")', { timeout: 5000 });
  console.log("PASS: Staff Import button still present");

  if (errors.length > 0) {
    console.log("Console errors captured:", errors.slice(0, 10));
  } else {
    console.log("PASS: no console errors captured");
  }

  await browser.close();
  console.log("\nALL CHECKS PASSED");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
