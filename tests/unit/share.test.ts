import { describe, expect, it } from "vitest";
import { newShareToken, SHARE_TOKEN } from "../../supabase/functions/_shared/share.ts";

describe("share tokens", () => {
  it("are 43-character base64url strings (256 bits)", () => {
    const t = newShareToken();
    expect(t).toMatch(SHARE_TOKEN);
    expect(t).toHaveLength(43);
  });

  it("don't repeat", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => newShareToken()));
    expect(seen.size).toBe(2000);
  });

  it("use the whole alphabet (not a narrow or sequential source)", () => {
    const chars = new Set(Array.from({ length: 200 }, () => newShareToken()).join(""));
    expect(chars.size).toBeGreaterThan(60);
  });
});
