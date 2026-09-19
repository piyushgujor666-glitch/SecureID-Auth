import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  ForgotPasswordBody,
  GetMeResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegisterBody,
  RegisterResponse,
  ResendOtpBody,
  ResetPasswordBody,
  ResetPasswordResponse,
  SendOtpBody,
  VerifyOtpBody,
  VerifyOtpResponse,
} from "@workspace/api-zod";
import { db, otpCodesTable, sessionsTable, usersTable } from "@workspace/db";
import {
  calculatePasswordStrength,
  clearSessionCookie,
  createOtp,
  findLatestOtp,
  hashValue,
  isPasswordStrongEnough,
  normalizeEmail,
  issueSession,
  publicUser,
  requireAuth,
  type AuthenticatedRequest,
} from "../lib/auth";

const router: IRouter = Router();

function developmentCode(code: string | undefined): string | null {
  return process.env.NODE_ENV === "production" ? null : (code ?? null);
}

async function findUserByEmail(email: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  return user;
}

async function sendCode(userId: string, type: string) {
  return createOtp(userId, type);
}

router.post("/auth/register", async (request, response): Promise<void> => {
  const parsed = RegisterBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: "Please check the details and try again." });
    return;
  }

  const input = { ...parsed.data, email: normalizeEmail(parsed.data.email) };
  if (!isPasswordStrongEnough(input.password)) {
    response.status(400).json({
      success: false,
      message: "Password must be at least Medium strength.",
    });
    return;
  }

  const existing = await findUserByEmail(input.email);
  if (existing) {
    response.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
    return;
  }

  const userId = crypto.randomUUID();
  const now = new Date();
  const [user] = await db
    .insert(usersTable)
    .values({
      id: userId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email,
      mobile: input.mobile.trim(),
      passwordHash: await bcrypt.hash(input.password, 12),
      emailVerified: false,
      mobileVerified: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const otp = await sendCode(user.id, "email");
  response.status(201).json(
    RegisterResponse.parse({
      success: true,
      message: "Your account is ready for verification.",
      devCode: developmentCode(otp.code),
    }),
  );
});

router.post("/auth/send-otp", async (request, response): Promise<void> => {
  const parsed = SendOtpBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: "Please provide a valid verification request." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await findUserByEmail(email);
  if (!user) {
    response.status(200).json({
      success: true,
      message: "If the account exists, a verification code has been sent.",
      devCode: null,
    });
    return;
  }

  const existing = await findLatestOtp(user.id, parsed.data.type);
  if (existing && Date.now() - existing.lastSentAt.getTime() < 45_000) {
    response.status(429).json({ success: false, message: "Please wait before requesting another code." });
    return;
  }
  const otp = await sendCode(user.id, parsed.data.type);
  response.json({
    success: true,
    message: "A verification code has been sent.",
    devCode: developmentCode(otp.code),
  });
});

router.post("/auth/resend-otp", async (request, response): Promise<void> => {
  const parsed = ResendOtpBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: "Please provide a valid verification request." });
    return;
  }
  const user = await findUserByEmail(normalizeEmail(parsed.data.email));
  if (!user) {
    response.status(200).json({
      success: true,
      message: "If the account exists, a new verification code has been sent.",
      devCode: null,
    });
    return;
  }
  const existing = await findLatestOtp(user.id, parsed.data.type);
  if (existing && Date.now() - existing.lastSentAt.getTime() < 45_000) {
    response.status(429).json({ success: false, message: "Please wait before requesting another code." });
    return;
  }
  const otp = await sendCode(user.id, parsed.data.type);
  response.json({
    success: true,
    message: "A new verification code has been sent.",
    devCode: developmentCode(otp.code),
  });
});

router.post("/auth/verify-otp", async (request, response): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: "Enter the six-digit code." });
    return;
  }

  const user = await findUserByEmail(normalizeEmail(parsed.data.email));
  const otp = user ? await findLatestOtp(user.id, parsed.data.type) : undefined;
  if (!user || !otp) {
    response.status(400).json({ success: false, message: "Invalid or expired code." });
    return;
  }
  if (otp.attempts >= 5) {
    response.status(429).json({ success: false, message: "Too many attempts. Request a new code." });
    return;
  }
  if (otp.expiresAt.getTime() <= Date.now()) {
    response.status(400).json({ success: false, message: "This code has expired. Request a new one." });
    return;
  }
  if (hashValue(parsed.data.code) !== otp.codeHash) {
    await db
      .update(otpCodesTable)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(otpCodesTable.id, otp.id));
    response.status(400).json({ success: false, message: "That code is not correct. Try again." });
    return;
  }

  await db.update(otpCodesTable).set({ verified: true }).where(eq(otpCodesTable.id, otp.id));
  if (parsed.data.type === "email") {
    await db.update(usersTable).set({ emailVerified: true, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  } else if (parsed.data.type === "mobile") {
    await db.update(usersTable).set({ mobileVerified: true, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  }

  const nextStep =
    parsed.data.type === "email"
      ? "mobile"
      : parsed.data.type === "mobile"
        ? "authenticator"
        : "success";
  response.json(
    VerifyOtpResponse.parse({
      success: true,
      message: "Code verified successfully.",
      nextStep,
    }),
  );
});

router.post("/auth/login", async (request, response): Promise<void> => {
  const parsed = LoginBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: "Enter your email and password." });
    return;
  }
  const user = await findUserByEmail(normalizeEmail(parsed.data.email));
  const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    response.status(401).json({ success: false, message: "Invalid email or password." });
    return;
  }
  if (!user.emailVerified) {
    response.status(403).json({ success: false, message: "Verify your email before logging in." });
    return;
  }
  await issueSession(user, response);
  response.json(
    LoginResponse.parse({
      success: true,
      message: "Welcome back.",
      user: publicUser(user),
    }),
  );
});

router.get("/me", requireAuth, async (request: AuthenticatedRequest, response): Promise<void> => {
  if (!request.auth) {
    response.status(401).json({ success: false, message: "Authentication required." });
    return;
  }
  response.json(GetMeResponse.parse(publicUser(request.auth.user)));
});

router.post("/auth/logout", requireAuth, async (request: AuthenticatedRequest, response): Promise<void> => {
  if (request.auth) {
    await db
      .update(sessionsTable)
      .set({ revoked: true })
      .where(eq(sessionsTable.id, request.auth.sessionId));
  }
  clearSessionCookie(response);
  response.json(LogoutResponse.parse({ success: true, message: "You have been logged out." }));
});

router.post("/auth/forgot-password", async (request, response): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, message: "Enter a valid email address." });
    return;
  }
  const user = await findUserByEmail(normalizeEmail(parsed.data.email));
  if (!user) {
    response.json({ success: true, message: "If an account exists, reset instructions have been sent.", devCode: null });
    return;
  }
  const otp = await sendCode(user.id, "reset");
  response.json({
    success: true,
    message: "If an account exists, reset instructions have been sent.",
    devCode: developmentCode(otp.code),
  });
});

router.post("/auth/reset-password", async (request, response): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(request.body);
  if (!parsed.success || !isPasswordStrongEnough(parsed.data.password)) {
    response.status(400).json({ success: false, message: "Choose a stronger password and try again." });
    return;
  }
  const user = await findUserByEmail(normalizeEmail(parsed.data.email));
  const otp = user ? await findLatestOtp(user.id, "reset") : undefined;
  if (!user || !otp || otp.expiresAt.getTime() <= Date.now() || hashValue(parsed.data.code) !== otp.codeHash) {
    response.status(400).json({ success: false, message: "Invalid or expired reset code." });
    return;
  }
  await db.update(usersTable).set({
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));
  await db.update(otpCodesTable).set({ verified: true }).where(eq(otpCodesTable.id, otp.id));
  await db.update(sessionsTable).set({ revoked: true }).where(eq(sessionsTable.userId, user.id));
  response.json(ResetPasswordResponse.parse({ success: true, message: "Password updated. You can now log in." }));
});

export default router;