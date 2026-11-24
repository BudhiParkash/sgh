import { describe, expect, it } from "vitest";
import { transition } from "../src/lib/content/workflow.js";
import { createPreviewToken, verifyPreviewToken } from "../src/lib/content/preview.js";

const actor = { actorId: "a1" };

describe("workflow transitions", () => {
  it("draft → review → approved → published → archived → draft", () => {
    let s = transition({ status: "draft" }, "submit", actor);
    expect(s.status).toBe("review");
    s = transition(s, "approve", actor);
    expect(s.status).toBe("approved");
    s = transition(s, "publish", { ...actor, now: new Date("2026-01-01") });
    expect(s.status).toBe("published");
    expect(s.publishedAt).toEqual(new Date("2026-01-01"));
    const again = transition(transition(s, "unpublish", actor), "publish", { ...actor, now: new Date("2026-02-01") });
    expect(again.publishedAt).toEqual(new Date("2026-01-01")); // original publish date kept
    s = transition(s, "archive", actor);
    expect(s.status).toBe("archived");
    expect(transition(s, "restore", actor).status).toBe("draft");
  });
  it("rejects invalid transitions", () => {
    expect(() => transition({ status: "draft" }, "approve", actor)).toThrow(/Can't approve/);
    expect(() => transition({ status: "archived" }, "publish", actor)).toThrow();
  });
  it("scheduling requires a future time", () => {
    expect(() => transition({ status: "draft" }, "schedule", { ...actor, publishAt: new Date(Date.now() - 1000) })).toThrow(/future/);
    expect(transition({ status: "draft" }, "schedule", { ...actor, publishAt: new Date(Date.now() + 3_600_000) }).status).toBe("scheduled");
  });
  it("preview tokens are signed and expire", () => {
    const t = createPreviewToken("article", "abc");
    expect(verifyPreviewToken(t)).toEqual({ t: "article", id: "abc" });
    expect(verifyPreviewToken(t.slice(0, -2) + "xx")).toBeNull();
    expect(verifyPreviewToken(createPreviewToken("article", "abc", -10))).toBeNull();
  });
});
