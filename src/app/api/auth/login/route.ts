import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  });

  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  });
}
