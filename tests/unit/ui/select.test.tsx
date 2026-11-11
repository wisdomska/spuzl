// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Select, flatOptions, type SelectItems } from "@/components/ui/Select";

/** R7: the app's own dropdown (Radix Select) in place of the browser's <select>. */
beforeAll(() => {
  // jsdom lacks these; Radix Select calls them.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(cleanup);

const OPTIONS: SelectItems = [
  { value: "", label: "Anyone" },
  { value: "system", label: "Automatic only" },
  { value: "a1", label: "Senya (owner)" },
  { value: "a2", label: "Kofi (moderator)", disabled: true },
  { value: "a3", label: "Ama (analyst)" },
];

function Harness({ initial = "", onChange = () => {} }: { initial?: string; onChange?: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <form data-testid="form">
      <label htmlFor="person">Person</label>
      <Select
        id="person"
        name="actor"
        aria-describedby="person-help"
        value={v}
        onValueChange={(x) => {
          setV(x);
          onChange(x);
        }}
        options={OPTIONS}
      />
      <p id="person-help">Who made the change.</p>
    </form>
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Person" });

describe("Select", () => {
  it("is a combobox named by its label, described by its help, showing the chosen option", () => {
    render(<Harness initial="a1" />);
    expect(trigger()).toHaveProperty("tagName", "BUTTON");
    expect(trigger().getAttribute("aria-describedby")).toBe("person-help");
    expect(trigger().textContent).toContain("Senya (owner)");
  });

  it("an empty value is a real option (All / Anyone), not the placeholder", () => {
    render(<Harness initial="" />);
    expect(trigger().textContent).toContain("Anyone");
  });

  it("opens with the keyboard, marks the chosen option, and picks with Enter", () => {
    const onChange = vi.fn();
    render(<Harness initial="system" onChange={onChange} />);
    act(() => trigger().focus());
    fireEvent.keyDown(trigger(), { key: "Enter" });
    const list = screen.getByRole("listbox");
    const chosen = within(list).getByRole("option", { name: "Automatic only" });
    expect(chosen.getAttribute("data-state")).toBe("checked");
    // the chosen one carries the lime check
    expect(chosen.querySelector("svg")).not.toBeNull();
    expect(within(list).getByRole("option", { name: "Kofi (moderator)" }).getAttribute("aria-disabled")).toBe("true");
    const ama = within(list).getByRole("option", { name: "Ama (analyst)" });
    act(() => ama.focus());
    fireEvent.keyDown(ama, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("a3");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().textContent).toContain("Ama (analyst)");
  });

  it("maps the empty value back out when picked", () => {
    const onChange = vi.fn();
    render(<Harness initial="a1" onChange={onChange} />);
    act(() => trigger().focus());
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const anyone = within(screen.getByRole("listbox")).getByRole("option", { name: "Anyone" });
    act(() => anyone.focus());
    fireEvent.keyDown(anyone, { key: " " });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("typeahead on the closed field jumps to the first match", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Harness initial="" onChange={onChange} />);
    act(() => trigger().focus());
    fireEvent.keyDown(trigger(), { key: "S" });
    expect(onChange).toHaveBeenLastCalledWith("a1");
    vi.useRealTimers();
  });

  it("Escape closes without changing the value", () => {
    const onChange = vi.fn();
    render(<Harness initial="a1" onChange={onChange} />);
    act(() => trigger().focus());
    fireEvent.keyDown(trigger(), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a disabled field doesn't open", () => {
    render(<Select aria-label="Role" value="a" disabled onValueChange={() => {}} options={[{ value: "a", label: "Owner" }]} />);
    const t = screen.getByRole("combobox", { name: "Role" });
    expect((t as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(t, { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("posts its value in a form through `name`", () => {
    render(<Harness initial="a3" />);
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("actor")).toBe("a3");
  });

  it("groups flatten for lookups", () => {
    expect(
      flatOptions([
        { label: "Team", options: [{ value: "x", label: "X" }] },
        { value: "y", label: "Y" },
      ]).map((o) => o.value),
    ).toEqual(["x", "y"]);
  });
});
