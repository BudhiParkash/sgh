import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { isActivePath } from "@/components/layout/nav-link";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});

describe("isActivePath", () => {
  it("matches home only exactly", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/news", "/")).toBe(false);
  });
  it("matches nested routes but not prefixes of other words", () => {
    expect(isActivePath("/tournaments/abc", "/tournaments")).toBe(true);
    expect(isActivePath("/newsletter", "/news")).toBe(false);
  });
});

describe("Button", () => {
  it("defaults to type=button and disables while loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });
});

describe("Field", () => {
  it("wires label, hint and error to the control", () => {
    render(
      <Field id="email" label="Email" hint="We reply here." error="Invalid email">
        {(aria) => <Input {...aria} />}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-hint email-error");
  });
});

describe("MediaImage", () => {
  it("loads media-library images directly with responsive variants (never via /_next/image)", async () => {
    const { MediaImage } = await import("@/components/ui/media-image");
    const image = { url: "https://shivanshigaming.com/media/a/1280.webp", alt: "BGIS finals stage", width: 1600, height: 900, srcSet: "https://shivanshigaming.com/media/a/640.webp 640w, https://shivanshigaming.com/media/a/1280.webp 1280w" };
    render(<div className="relative"><MediaImage image={image} fill sizes="33vw" /></div>);
    const img = screen.getByRole("img", { name: "BGIS finals stage" });
    expect(img.getAttribute("src")).toBe(image.url);
    expect(img.getAttribute("srcset")).toBe(image.srcSet);
    expect(img.getAttribute("sizes")).toBe("33vw");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("src")).not.toContain("/_next/image");
  });
});
