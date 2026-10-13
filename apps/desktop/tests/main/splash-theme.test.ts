import { describe, expect, test } from "vitest";

import { createPendingHtml, splashBackgroundColor } from "../../src/main/runtime.js";

describe("splash theme palette", () => {
  test("uses the light palette", () => {
    const html = decodeURIComponent(createPendingHtml("light").split(",")[1] ?? "");
    expect(splashBackgroundColor("light")).toBe("#f2f4f5");
    expect(html).toContain("color: #7a838a");
    expect(html).toContain("color: #9aa2a8");
    expect(html).toContain("rgba(122, 131, 138, 0.18)");
    expect(html).toContain("background: #7a838a");
  });

  test("uses the dark palette", () => {
    const html = decodeURIComponent(createPendingHtml("dark").split(",")[1] ?? "");
    expect(splashBackgroundColor("dark")).toBe("#202020");
    expect(html).toContain("color: #bdbdbd");
    expect(html).toContain("color: #848484");
    expect(html).toContain("rgba(189, 189, 189, 0.18)");
    expect(html).toContain("background: #bdbdbd");
    expect(html).not.toContain("#f2f4f5");
  });
});
