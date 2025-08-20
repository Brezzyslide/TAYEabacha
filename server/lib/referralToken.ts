/**
 * JWT token utilities for referral links
 * Secure token signing and verification for public referral forms
 */

import jwt from "jsonwebtoken";

const secret = process.env.REFERRAL_LINK_SECRET || "development_referral_secret";

if (!process.env.REFERRAL_LINK_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("REFERRAL_LINK_SECRET must be set in production");
}

export interface ReferralTokenPayload {
  linkId: string;
  tenantId: number;
  exp?: number;
  iat?: number;
}

export function signReferralToken(payload: { linkId: string; tenantId: number; exp?: number }): string {
  const options = payload.exp ? {} : { expiresIn: "90d" };
  return jwt.sign(payload, secret, options);
}

export function verifyReferralToken(token: string): ReferralTokenPayload {
  try {
    return jwt.verify(token, secret) as ReferralTokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}