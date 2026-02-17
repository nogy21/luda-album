// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookies } from "next/headers";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  isAdminAuthConfigured,
  validateAdminPassword,
} from "@/lib/admin/session";

import { POST } from "./route";

const cookiesSetMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: cookiesSetMock,
  })),
}));

vi.mock("@/lib/admin/session", () => ({
  ADMIN_SESSION_COOKIE: "luda_admin_session",
  ADMIN_SESSION_TTL_SECONDS: 60 * 60 * 8,
  createAdminSessionToken: vi.fn(),
  isAdminAuthConfigured: vi.fn(),
  validateAdminPassword: vi.fn(),
}));

const cookiesMock = vi.mocked(cookies);
const isAdminAuthConfiguredMock = vi.mocked(isAdminAuthConfigured);
const validateAdminPasswordMock = vi.mocked(validateAdminPassword);
const createAdminSessionTokenMock = vi.mocked(createAdminSessionToken);

describe("POST /api/admin/auth (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesSetMock.mockReset();
  });

  it("returns 503 when admin auth is not configured", async () => {
    isAdminAuthConfiguredMock.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "pw" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "관리자 인증이 아직 설정되지 않았어요.",
    });
  });

  it("returns 400 on malformed JSON payload", async () => {
    isAdminAuthConfiguredMock.mockReturnValue(true);

    const response = await POST(
      new Request("http://localhost/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "요청 형식이 올바르지 않아요.",
    });
  });

  it("returns 401 on invalid password", async () => {
    isAdminAuthConfiguredMock.mockReturnValue(true);
    validateAdminPasswordMock.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "비밀번호가 올바르지 않아요.",
    });
  });

  it("returns 500 when session token creation fails", async () => {
    isAdminAuthConfiguredMock.mockReturnValue(true);
    validateAdminPasswordMock.mockReturnValue(true);
    createAdminSessionTokenMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "correct" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "관리자 세션을 만들지 못했어요.",
    });
  });

  it("sets admin cookie and returns authenticated on success", async () => {
    isAdminAuthConfiguredMock.mockReturnValue(true);
    validateAdminPasswordMock.mockReturnValue(true);
    createAdminSessionTokenMock.mockReturnValue("issued.signature");

    const response = await POST(
      new Request("http://localhost/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "correct" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: true });
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(cookiesSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: ADMIN_SESSION_COOKIE,
        value: "issued.signature",
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        maxAge: ADMIN_SESSION_TTL_SECONDS,
      }),
    );
  });
});
