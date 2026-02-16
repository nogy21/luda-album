import { describe, expect, test } from "vitest";

import {
  DEFAULT_PWA_ICON_PATHS,
  buildDefaultPwaBranding,
  parseStoredPwaBrandingValue,
} from "./branding";

describe("pwa branding", () => {
  test("buildDefaultPwaBranding returns bundled icon paths", () => {
    const branding = buildDefaultPwaBranding();

    expect(branding.isCustom).toBe(false);
    expect(branding.version).toBe("default");
    expect(branding.icons.icon192).toBe(DEFAULT_PWA_ICON_PATHS.icon192);
    expect(branding.icons.icon512).toBe(DEFAULT_PWA_ICON_PATHS.icon512);
    expect(branding.icons.maskable512).toBe(DEFAULT_PWA_ICON_PATHS.maskable512);
    expect(branding.icons.appleTouch).toBe(DEFAULT_PWA_ICON_PATHS.appleTouch);
    expect(branding.storagePaths).toEqual([]);
  });

  test("parseStoredPwaBrandingValue maps valid setting payload", () => {
    const parsed = parseStoredPwaBrandingValue(
      {
        icons: {
          icon192: {
            url: "https://cdn.example.com/icon-192.png",
            storagePath: "branding/pwa/icon-192.png",
          },
          icon512: {
            url: "https://cdn.example.com/icon-512.png",
            storagePath: "branding/pwa/icon-512.png",
          },
          maskable512: {
            url: "https://cdn.example.com/maskable-512.png",
            storagePath: "branding/pwa/maskable-512.png",
          },
          appleTouch: {
            url: "https://cdn.example.com/apple-touch.png",
            storagePath: "branding/pwa/apple-touch.png",
          },
        },
      },
      "2026-02-16T14:00:00.000Z",
    );

    expect(parsed).toMatchObject({
      isCustom: true,
      version: "2026-02-16T14:00:00.000Z",
      icons: {
        icon192: "https://cdn.example.com/icon-192.png",
        icon512: "https://cdn.example.com/icon-512.png",
        maskable512: "https://cdn.example.com/maskable-512.png",
        appleTouch: "https://cdn.example.com/apple-touch.png",
      },
    });
    expect(parsed?.storagePaths.sort()).toEqual([
      "branding/pwa/apple-touch.png",
      "branding/pwa/icon-192.png",
      "branding/pwa/icon-512.png",
      "branding/pwa/maskable-512.png",
    ]);
  });

  test("parseStoredPwaBrandingValue returns null for malformed payload", () => {
    const parsed = parseStoredPwaBrandingValue(
      {
        icons: {
          icon192: {
            url: "https://cdn.example.com/icon-192.png",
          },
        },
      },
      "2026-02-16T14:00:00.000Z",
    );

    expect(parsed).toBeNull();
  });
});
