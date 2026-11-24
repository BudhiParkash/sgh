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
