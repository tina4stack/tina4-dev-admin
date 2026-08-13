import { describe, expect, it } from "vitest";
import { groundingStatusView } from "../src/components/Editor";

// The FREE-TOKEN trial: with no personal token the agent sends the shared
// FREE-TOKEN and reports source:"free", and the panel must persistently nudge
// the developer to register. These assert the real state→view logic (pure, no
// DOM/fetch) the panel renders from GET /__dev/api/grounding/status.

describe("grounding panel — FREE-TOKEN trial states", () => {
  it("free trial shows the trial badge AND the persistent register nudge", () => {
    const v = groundingStatusView({ source: "free", url: "https://mcp.tina4.com" });
    expect(v.source).toBe("free");
    expect(v.stateHtml).toContain("Free trial");
    expect(v.stateHtml).toContain("FREE-TOKEN");
    // The nudge is the whole point — a register CTA to profile.tina4.com.
    expect(v.nudgeHtml).toContain("profile.tina4.com");
    expect(v.nudgeHtml.toLowerCase()).toContain("register");
    expect(v.nudgeHtml).toContain("href=\"https://profile.tina4.com\"");
  });

  it("personal token shows 'Your token' with last4 and NO nudge", () => {
    const v = groundingStatusView({ source: "personal", last4: "aB9x" });
    expect(v.source).toBe("personal");
    expect(v.stateHtml).toContain("Your token");
    expect(v.stateHtml).toContain("aB9x");
    expect(v.nudgeHtml).toBe(""); // never nag a paying/registered user
  });

  it("none (free rung disabled, no personal) falls back to local corpus, no nudge", () => {
    const v = groundingStatusView({ source: "none" });
    expect(v.source).toBe("none");
    expect(v.stateHtml).toContain("local corpus fallback");
    expect(v.nudgeHtml).toBe("");
  });

  it("back-compat: an older backend sending only {configured:true} reads as personal", () => {
    const v = groundingStatusView({ configured: true, last4: "1234" });
    expect(v.source).toBe("personal");
    expect(v.stateHtml).toContain("1234");
    expect(v.nudgeHtml).toBe("");
  });

  it("back-compat: {configured:false} with no source reads as none (not free)", () => {
    // Critical: an old backend that predates FREE-TOKEN must NOT surface a
    // free-trial nudge it can't actually honour.
    const v = groundingStatusView({ configured: false });
    expect(v.source).toBe("none");
    expect(v.nudgeHtml).toBe("");
  });
});
