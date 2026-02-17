import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";

import { resetBrowserStorageMocks } from "./test/setup/storage-mock";

beforeEach(() => {
  resetBrowserStorageMocks();
});

afterEach(() => {
  resetBrowserStorageMocks();
});
