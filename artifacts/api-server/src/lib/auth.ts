import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { and, desc, eq } from "drizzle-orm";
import { db, otpCodesTable, sessionsTable, usersTable, type User } from "@workspace/db";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const COOKIE_NAME = "secureid_session";

type TokenPayload = {
  userId: string;
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  auth?: {
    user: User;
    sessionId: string;
  };
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET or SESSION_SECRET must be configured");
  }
  return secret;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function publicUser(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

export function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function calculatePasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function isPasswordStrongEnough(password: string): boolean {
  return calculatePasswordStrength(password) >= 3;
}

export async function findLatestOtp(userId: string, type: string) {
  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.userId, userId),
        eq(otpCodesTable.type, type),
        eq(otpCodesTable.verified, false),
      ),
    )
    .orderBy(desc(otpCodesTable.createdAt))
    .limit(1);
  return otp;
}

export async function createOtp(userId: string, type: string) {
  const code = generateOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  await db
    .update(otpCodesTable)
    .set({ verified: true })
    .where(
      and(
        eq(otpCodesTable.userId, userId),
        eq(otpCodesTable.type, type),
        eq(otpCodesTable.verified, false),
      ),
    );
  await db.insert(otpCodesTable).values({
    id: crypto.randomUUID(),
    userId,
    type,
    codeHash: hashValue(code),
    expiresAt,
    attempts: 0,
    verified: false,
    lastSentAt: now,
    createdAt: now,
  });
  return { code, expiresAt };
}

export async function issueSession(user: User, response: Response): Promise<void> {
  const sessionId = crypto.randomUUID();
  const token = jwt.sign({ userId: user.id, sessionId } satisfies TokenPayload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

  await db.insert(sessionsTable).values({
    id: sessionId,
    userId: user.id,
    tokenHash: hashValue(token),
    expiresAt,
    revoked: false,
  });

  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    path: "/",
  });
}

function readToken(request: Request): string | null {
  const cookieToken = (request as Request & { cookies?: Record<string, string> }).cookies?.[
    COOKIE_NAME
  ];
  if (cookieToken) return cookieToken;

  const authorization = request.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return null;
}

export async function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const token = readToken(request);
  if (!token) {
    response.status(401).json({ success: false, message: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as TokenPayload;
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.id, payload.sessionId),
          eq(sessionsTable.tokenHash, hashValue(token)),
          eq(sessionsTable.revoked, false),
        ),
      )
      .limit(1);

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      response.status(401).json({ success: false, message: "Session expired. Please log in again." });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);
    if (!user) {
      response.status(401).json({ success: false, message: "Account not found." });
      return;
    }

    request.auth = { user, sessionId: session.id };
    next();
  } catch {
    response.status(401).json({ success: false, message: "Invalid session." });
  }
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
}