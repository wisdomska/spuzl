// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { BirthPicker, type Birth } from "@/components/onboarding/BirthPicker";

/** R7: one dialog frame for the player app and the admin, and the birth month as twelve buttons. */
afterEach(cleanup);

function Opener({ kind, dismissible = true }: { kind: "sheet" | "dialog"; dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        kind={kind}
        role="alertdialog"
        open={open}
        onOpenChange={setOpen}
        dismissible={dismissible}
        title="Delete Harmattan Week?"
        description="This can't be undone."
        footer={
          <ModalActions>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button">Delete event</button>
          </ModalActions>
        }
      />
    </>
  );
}

describe("Modal", () => {
  for (const kind of ["sheet", "dialog"] as const) {
    it(`${kind}: labelled and described, a 44 px close button, Escape closes`, () => {
      render(<Opener kind={kind} />);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      const d = screen.getByRole("alertdialog", { name: "Delete Harmattan Week?" });
      expect(d.getAttribute("aria-describedby")).toBeTruthy();
      expect(document.getElementById(d.getAttribute("aria-describedby")!)?.textContent).toBe("This can't be undone.");
      expect(d.className).toContain(kind === "sheet" ? "sheet-content" : "modal-content");
      const close = screen.getByRole("button", { name: "Close" });
      expect(close.className).toContain("size-11");
      // the main action is last (right)
      const actions = d.querySelector("[data-modal-actions]")!;
      expect(actions.lastElementChild?.textContent).toBe("Delete event");
      fireEvent.keyDown(d, { key: "Escape" });
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  }

  it("while busy (not dismissible) Escape and the close button do nothing", () => {
    render(<Opener kind="dialog" dismissible={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const d = screen.getByRole("alertdialog");
    expect((screen.getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(d, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("the close button closes", () => {
    render(<Opener kind="sheet" />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("BirthPicker month", () => {
  function Picker({ onChange }: { onChange: (b: Birth) => void }) {
    const [b, setB] = useState<Birth>({ year: null, month: null });
    return (
      <BirthPicker
        value={b}
        onChange={(x) => {
          setB(x);
          onChange(x);
        }}
      />
    );
  }

  it("is a radio group named Month with twelve full month names; a tap picks one", () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    const group = screen.getByRole("radiogroup", { name: "Month" });
    const radios = group.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(12);
    const june = screen.getByRole("radio", { name: "June" });
    fireEvent.click(june);
    expect(onChange).toHaveBeenLastCalledWith({ year: null, month: 6 });
    expect((june as HTMLInputElement).checked).toBe(true);
    // the year is still the 4-digit field
    expect(screen.getByLabelText("Year").getAttribute("inputmode")).toBe("numeric");
  });
});
