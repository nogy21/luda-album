import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "luda_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

const getAdminPassword = () => {
  return process.env.ADMIN_UPLOAD_PASSWORD ?? null;
};

const getSessionSecret = () => {
  return process.env.ADMIN_SESSION_SECRET ?? getAdminPassword();
};

const signIssuedAt = (issuedAt: string, secret: string) => {
  return createHmac("sha256", secret).update(issuedAt).digest("hex");
};

export const isAdminAuthConfigured = () => {
  return Boolean(getAdminPassword() && getSessionSecret());
};

export const validateAdminPassword = (password: string) => {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return false;
  }

  return password === adminPassword;
};

export const createAdminSessionToken = () => {
  const secret = getSessionSecret();

  if (!secret) {
    return null;
  }

  const issuedAt = `${Date.now()}`;
  const signature = signIssuedAt(issuedAt, secret);
  return `${issuedAt}.${signature}`;
};

export const verifyAdminSessionToken = (token: string | undefined) => {
  const secret = getSessionSecret();

  if (!token || !secret) {
    return false;
  }

  const [issuedAt, signature] = token.split(".");

  if (!issuedAt || !signature) {
    return false;
  }

  const issuedAtNumber = Number(issuedAt);

  if (!Number.isFinite(issuedAtNumber)) {
    return false;
  }

  const expiresAt = issuedAtNumber + ADMIN_SESSION_TTL_SECONDS * 1000;

  if (Date.now() > expiresAt) {
    return false;
  }

  const expected = signIssuedAt(issuedAt, secret);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
};

