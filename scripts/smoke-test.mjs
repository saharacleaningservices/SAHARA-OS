import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSQLite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.upsert({
  where: { email: "smoketest@sahara.local" },
  update: {},
  create: {
    name: "Smoke Test",
    email: "smoketest@sahara.local",
    passwordHash: "x",
    role: "ADMIN",
  },
});
console.log("Created/found user:", user.id, user.email);

const count = await prisma.user.count();
console.log("Total users:", count);

await prisma.user.delete({ where: { id: user.id } });
console.log("Cleaned up. Smoke test PASSED.");

await prisma.$disconnect();
