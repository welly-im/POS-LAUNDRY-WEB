import { db, users, sessions, outlets } from "../db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "pos_laundry_session";
const SESSION_MAX_AGE_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  return token;
}

export async function validateSession(sessionId: string) {
  if (!sessionId) return null;

  const now = new Date();

  const foundSession = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)),
    with: {
      user: {
        with: {
          outlet: true,
        },
      },
    },
  });

  if (!foundSession || !foundSession.user || !foundSession.user.isActive) {
    return null;
  }

  return {
    session: {
      id: foundSession.id,
      expiresAt: foundSession.expiresAt,
    },
    user: foundSession.user,
    outlet: foundSession.user.outlet,
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
