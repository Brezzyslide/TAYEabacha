// server/secretsCheck.ts
import crypto from "crypto";

function shortHash(v?: string) {
  if (!v) return "missing";
  const h = crypto.createHash("sha256").update(v).digest("hex");
  return `${h.slice(0,8)}…${h.slice(-8)} (len=${v.length})`;
}

export function verifySecrets() {
  const jwt = process.env.JWT_SECRET;
  const pep = process.env.PASSWORD_PEPPER;

  if (!jwt || jwt.length < 32) {
    throw new Error("JWT_SECRET is missing or too short (need strong random).");
  }
  if (!pep || pep.length < 64) {
    throw new Error("PASSWORD_PEPPER is missing or too short (need strong random).");
  }

  // Fingerprints only — no raw secrets in logs
  console.info("[secrets] JWT_SECRET ok:", shortHash(jwt));
  console.info("[secrets] PASSWORD_PEPPER ok:", shortHash(pep));
}