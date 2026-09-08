// Sahara OS — database seed
// Run with: npm run db:seed
//
// Populates realistic demo data: 5 login users, 20 staff, historical jobs,
// photos, certificates, payments, expenses, attendance and a running seed
// for reports/profit — enough for every dashboard chart and list to render
// with real numbers. Leads are intentionally left empty: production starts
// with zero leads, created via the "New Inquiry" button or the Leads page.

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, ""));
const adapter = new PrismaBetterSQLite3({ url: `file:${dbPath}` });
const db = new PrismaClient({ adapter });

// Fresh-install bootstrap passwords. Each account gets a distinct one; every
// non-admin account is flagged mustChangePassword and must set a personal
// password on first login (see scripts/db-setup.mjs + /set-password).
const DEMO_PASSWORD = "Sahara@2026"; // legacy default, kept for tests referencing it
const BOOTSTRAP_PASSWORDS: Record<string, string> = {
  "admin@saharacleaningservices.com": "Altaf#Sahara2026!",
  "operations@saharacleaningservices.com": "Francis#Sahara2026!",
  "accounts@saharacleaningservices.com": "Shoyab#Sahara2026!",
  "supervisor@saharacleaningservices.com": "Suresh#Sahara2026!",
  "staff@saharacleaningservices.com": "Vikas#Sahara2026!",
};

const AREAS = [
  "Magarpatta City",
  "Hadapsar",
  "Kharadi",
  "Viman Nagar",
  "Koregaon Park",
  "Wagholi",
  "NIBM Road",
  "Amanora Park Town",
  "Fatima Nagar",
  "Kondhwa",
  "Camp",
  "Baner",
];

const SERVICES = [
  "HOME_DEEP_CLEANING",
  "COMMERCIAL_CLEANING",
  "HOUSEKEEPING",
  "PEST_CONTROL",
  "INTERIOR_PAINTING",
] as const;

const CUSTOMER_NAMES = [
  "Anjali Deshpande", "Rohit Kulkarni", "Priya Nair", "Vivek Joshi", "Sneha Patil",
  "Arjun Mehta", "Kavita Rao", "Siddharth Bhat", "Neha Shah", "Manoj Iyer",
  "Pooja Kapoor", "Aditya Verma", "Ritu Agarwal", "Karan Malhotra", "Divya Menon",
  "Rajesh Khanna", "Sonal Trivedi", "Nikhil Bansal", "Meera Iyengar", "Suresh Reddy",
  "Ayesha Khan", "Varun Chopra", "Lakshmi Krishnan", "Farhan Ansari",
];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(randInt(9, 18), rand([0, 15, 30, 45]), 0, 0);
  return d;
}
function mobile() {
  return `9${randInt(0, 9)}${randInt(100000000, 999999999)}`.slice(0, 10);
}
function quoteFor(service: string) {
  const base: Record<string, [number, number]> = {
    HOME_DEEP_CLEANING: [3999, 9999],
    COMMERCIAL_CLEANING: [8999, 45000],
    HOUSEKEEPING: [5999, 25000],
    PEST_CONTROL: [3999, 8999],
    INTERIOR_PAINTING: [12999, 60000],
  };
  const [min, max] = base[service];
  return Math.round(randInt(min, max) / 100) * 100;
}

async function main() {
  console.log("Seeding Sahara OS...");

  // ── Users ────────────────────────────────────────────────────────────
  const hash = (email: string) => bcrypt.hash(BOOTSTRAP_PASSWORDS[email] ?? DEMO_PASSWORD, 10);

  const altaf = await db.user.upsert({
    where: { email: "admin@saharacleaningservices.com" },
    update: {},
    create: {
      name: "Altaf Shaikh",
      email: "admin@saharacleaningservices.com",
      phone: "7083347130",
      passwordHash: await hash("admin@saharacleaningservices.com"),
      role: "ADMIN",
    },
  });

  // Francis Monteiro — Operations Manager (operations@ login).
  const francis = await db.user.upsert({
    where: { email: "operations@saharacleaningservices.com" },
    update: {},
    create: {
      name: "Francis Monteiro",
      email: "operations@saharacleaningservices.com",
      phone: "8956567130",
      passwordHash: await hash("operations@saharacleaningservices.com"),
      role: "OPERATIONS",
      mustChangePassword: true,
    },
  });

  // Shoyab Shaikh — Office Assistant (accounts@ login).
  const shoyab = await db.user.upsert({
    where: { email: "accounts@saharacleaningservices.com" },
    update: {},
    create: {
      name: "Shoyab Shaikh",
      email: "accounts@saharacleaningservices.com",
      passwordHash: await hash("accounts@saharacleaningservices.com"),
      role: "ACCOUNTS",
      mustChangePassword: true,
    },
  });

  const supervisorUser = await db.user.upsert({
    where: { email: "supervisor@saharacleaningservices.com" },
    update: {},
    create: {
      name: "Suresh Pawar",
      email: "supervisor@saharacleaningservices.com",
      passwordHash: await hash("supervisor@saharacleaningservices.com"),
      role: "SUPERVISOR",
      mustChangePassword: true,
    },
  });

  const staffUser = await db.user.upsert({
    where: { email: "staff@saharacleaningservices.com" },
    update: {},
    create: {
      name: "Vikas Shinde",
      email: "staff@saharacleaningservices.com",
      passwordHash: await hash("staff@saharacleaningservices.com"),
      role: "STAFF",
      mustChangePassword: true,
    },
  });

  console.log("Users created.");

  // ── Staff (20) ───────────────────────────────────────────────────────
  const staffSeed: { name: string; designation: string; salaryType: "DAILY" | "MONTHLY"; wage: number; userId?: string }[] = [
    { name: "Suresh Pawar", designation: "Supervisor", salaryType: "MONTHLY", wage: 22000, userId: supervisorUser.id },
    { name: "Ramesh Jadhav", designation: "Supervisor", salaryType: "MONTHLY", wage: 21000 },
    { name: "Vikas Shinde", designation: "Cleaning Executive", salaryType: "DAILY", wage: 650, userId: staffUser.id },
    { name: "Sandeep More", designation: "Cleaning Executive", salaryType: "DAILY", wage: 650 },
    { name: "Amit Kadam", designation: "Cleaning Executive", salaryType: "DAILY", wage: 650 },
    { name: "Rahul Gaikwad", designation: "Cleaning Executive", salaryType: "DAILY", wage: 600 },
    { name: "Prakash Waghmare", designation: "Cleaning Executive", salaryType: "DAILY", wage: 600 },
    { name: "Santosh Bhosale", designation: "Cleaning Executive", salaryType: "DAILY", wage: 600 },
    { name: "Ganesh Kale", designation: "Cleaning Executive", salaryType: "DAILY", wage: 650 },
    { name: "Nitin Salunkhe", designation: "Cleaning Executive", salaryType: "DAILY", wage: 600 },
    { name: "Dattatray Chavan", designation: "Cleaning Executive", salaryType: "DAILY", wage: 600 },
    { name: "Mahesh Jagtap", designation: "Cleaning Executive", salaryType: "DAILY", wage: 650 },
    { name: "Kiran Thorat", designation: "Cleaning Executive", salaryType: "DAILY", wage: 600 },
    { name: "Sunil Mane", designation: "Painter", salaryType: "DAILY", wage: 800 },
    { name: "Vijay Kadlag", designation: "Painter", salaryType: "DAILY", wage: 800 },
    { name: "Anil Bhagat", designation: "Pest Control Technician", salaryType: "DAILY", wage: 750 },
    { name: "Deepak Londhe", designation: "Pest Control Technician", salaryType: "DAILY", wage: 750 },
    { name: "Pooja Sathe", designation: "Cleaning Executive", salaryType: "DAILY", wage: 550 },
    { name: "Snehal Kamble", designation: "Cleaning Executive", salaryType: "DAILY", wage: 550 },
    { name: "Manisha Gophane", designation: "Housekeeping Executive", salaryType: "DAILY", wage: 550 },
  ];

  const staffRecords = [];
  for (let i = 0; i < staffSeed.length; i++) {
    const s = staffSeed[i];
    const employeeCode = `SCS-${String(i + 1).padStart(3, "0")}`;
    const existing = await db.staff.findUnique({ where: { employeeCode } });
    const staff = existing
      ? existing
      : await db.staff.create({
          data: {
            employeeCode,
            name: s.name,
            mobile: mobile(),
            designation: s.designation,
            salaryType: s.salaryType,
            dailyWage: s.salaryType === "DAILY" ? s.wage : null,
            monthlySalary: s.salaryType === "MONTHLY" ? s.wage : null,
            availability: rand(["AVAILABLE", "AVAILABLE", "AVAILABLE", "ON_JOB"] as const),
            joinDate: daysFromNow(-randInt(60, 900)),
            userId: s.userId,
          },
        });
    staffRecords.push(staff);
  }
  const supervisors = staffRecords.filter((s) => s.designation === "Supervisor");
  const fieldStaff = staffRecords.filter((s) => s.designation !== "Supervisor");
  console.log(`${staffRecords.length} staff created.`);

  // ── Attendance (last 10 days) ───────────────────────────────────────
  for (const staff of staffRecords) {
    for (let d = 0; d < 10; d++) {
      const date = daysFromNow(-d);
      date.setHours(0, 0, 0, 0);
      const roll = Math.random();
      const status = roll > 0.93 ? "ABSENT" : roll > 0.88 ? "LEAVE" : roll > 0.83 ? "HALF_DAY" : "PRESENT";
      const wage = staff.salaryType === "DAILY" ? staff.dailyWage ?? 0 : (staff.monthlySalary ?? 0) / 30;
      try {
        await db.attendance.create({
          data: {
            staffId: staff.id,
            date,
            status,
            checkInTime: status !== "ABSENT" ? daysFromNow(-d) : null,
            checkOutTime: status === "PRESENT" ? daysFromNow(-d) : null,
            wageForDay: status === "ABSENT" ? 0 : status === "HALF_DAY" ? wage / 2 : wage,
          },
        });
      } catch {
        // unique constraint on rerun — ignore
      }
    }
  }
  console.log("Attendance seeded.");

  // Leads start empty in production — Sahara OS ships with zero demo leads.
  // Create real leads via the "New Inquiry" button on the Dashboard or the
  // Leads page. Jobs, payments and expenses below are still seeded as
  // standalone historical records so Reports/Jobs/Payments/Profit have data
  // to render even with no leads yet.
  let jobCount = await db.job.count();
  let invoiceCount = await db.payment.count();
  let certCount = await db.certificate.count();

  // ── Historical jobs (last 90 days) so revenue/profit charts have depth ──
  for (let i = 0; i < 24; i++) {
    const service = rand(SERVICES);
    const scheduledDate = daysFromNow(-randInt(5, 90));
    const supervisor = rand(supervisors);
    const crew = [rand(fieldStaff), rand(fieldStaff)];
    const jobValue = quoteFor(service);
    jobCount += 1;
    const jobNumber = `JOB-2026-${String(jobCount).padStart(4, "0")}`;
    const customerName = rand(CUSTOMER_NAMES);
    const area = rand(AREAS);

    const job = await db.job.create({
      data: {
        jobNumber,
        customerName,
        customerMobile: mobile(),
        address: `House ${randInt(1, 300)}, ${area}`,
        area,
        service,
        scheduledDate,
        scheduledTime: `${randInt(9, 17)}:00`,
        supervisorId: supervisor.id,
        status: "COMPLETED",
        startedAt: scheduledDate,
        completedAt: scheduledDate,
        jobValue,
        customerSignatureUrl: "/uploads/signatures/placeholder-signature.svg",
        signedAt: scheduledDate,
      },
    });
    for (const member of crew) {
      await db.jobAssignment.create({ data: { jobId: job.id, staffId: member.id, isLead: member.id === crew[0].id } }).catch(() => {});
    }

    await db.photo.create({ data: { jobId: job.id, type: "BEFORE", url: "/uploads/photos/placeholder-before.svg", caption: "Before cleaning", uploadedById: supervisor.userId ?? shoyab.id } });
    await db.photo.create({ data: { jobId: job.id, type: "AFTER", url: "/uploads/photos/placeholder-after.svg", caption: "After cleaning", uploadedById: supervisor.userId ?? shoyab.id } });

    certCount += 1;
    await db.certificate.create({
      data: {
        jobId: job.id,
        certificateNumber: `CERT-2026-${String(certCount).padStart(4, "0")}`,
        issuedDate: scheduledDate,
        customerName,
        serviceSummary: `${service.replaceAll("_", " ")} completed at ${area} by ${supervisor.name}'s team.`,
        supervisorName: supervisor.name,
        signatureUrl: "/uploads/signatures/placeholder-signature.svg",
      },
    });

    invoiceCount += 1;
    const isPaid = Math.random() > 0.15;
    const dueDate = new Date(scheduledDate);
    dueDate.setDate(dueDate.getDate() + 7);
    await db.payment.create({
      data: {
        invoiceNumber: `INV-2026-${String(invoiceCount).padStart(4, "0")}`,
        jobId: job.id,
        clientName: customerName,
        clientMobile: job.customerMobile,
        amount: jobValue,
        paidAmount: isPaid ? jobValue : 0,
        dueDate,
        paidDate: isPaid ? scheduledDate : null,
        status: isPaid ? "PAID" : dueDate < new Date() ? "OVERDUE" : "PENDING",
        mybillbookInvoiceNo: `MBB-${randInt(10000, 99999)}`,
        recordedById: shoyab.id,
      },
    });
  }
  console.log("Historical jobs for chart data created.");

  // ── Expenses ─────────────────────────────────────────────────────────
  const expenseSeed: { category: string; desc: string; range: [number, number] }[] = [
    { category: "HOUSEKEEPING_MATERIAL", desc: "Housekeeping material & detergents restock", range: [500, 3200] },
    { category: "FUEL", desc: "Petrol for site-visit bikes", range: [300, 1500] },
    { category: "AUTO_CAB_FARE", desc: "Auto / cab fare for site visits", range: [150, 900] },
    { category: "EQUIPMENT", desc: "Vacuum cleaner / scrubber purchase", range: [1500, 9000] },
    { category: "BIKE_SERVICE", desc: "Bike servicing & repairs", range: [400, 2500] },
    { category: "STAFF_ADVANCE", desc: "Staff advance", range: [1000, 5000] },
    { category: "VENDOR_PAYMENT", desc: "Vendor payment", range: [800, 6000] },
    { category: "MISCELLANEOUS", desc: "Miscellaneous site expense", range: [200, 2000] },
  ];
  for (let i = 0; i < 35; i++) {
    const e = rand(expenseSeed);
    const amount = randInt(e.range[0], e.range[1]);
    await db.expense.create({
      data: {
        category: e.category as never,
        description: e.desc,
        amount,
        date: daysFromNow(-randInt(0, 90)),
        paidTo: e.category === "STAFF_ADVANCE" ? rand(fieldStaff).name : rand(["Local Vendor", "Pune Chemicals Co.", "Petrol Pump - Hadapsar", "Hardware Store"]),
        staffId: e.category === "STAFF_ADVANCE" ? rand(fieldStaff).id : null,
        addedById: shoyab.id,
      },
    });
  }
  console.log("Expenses seeded.");

  console.log("\nSeed complete.");
  console.log("Bootstrap logins (non-admin accounts must set a personal password on first login):");
  for (const [email, pw] of Object.entries(BOOTSTRAP_PASSWORDS)) console.log(`  ${email.padEnd(42)} ${pw}`);
  console.log([altaf, shoyab, francis, supervisorUser, staffUser].map((u) => `${u.role.padEnd(10)} ${u.email}`).join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
