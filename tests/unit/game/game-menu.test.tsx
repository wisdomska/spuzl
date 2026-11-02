// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GameMenu, type GameMenuEntry } from "@/components/game/GameMenu";
import { splitTools } from "@/components/game/GameShell";
import { useSettings } from "@/lib/settings/store";
import type { ControlSpec } from "@/games/types";

beforeAll(() => {
  // jsdom lacks what Radix's positioning and motion read; none of it matters for these checks.
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});
afterEach(cleanup);

function Harness({ sections, note, shield }: { sections: GameMenuEntry[][]; note?: string; shield?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GameMenu open={open} onOpenChange={setOpen} sections={sections} note={note} shield={shield} />
      <span data-testid="state">{open ? "open" : "closed"}</span>
    </>
  );
}

function setup(o: { note?: string; shield?: boolean } = {}) {
  act(() => useSettings.setState({ hydrated: true, reducedMotion: "off" }));
  const help = vi.fn();
  const restart = vi.fn();
  const sound = vi.fn();
  const sections: GameMenuEntry[][] = [
    [
      { kind: "action", id: "help", label: "How to play", icon: "question", onSelect: help },
      { kind: "action", id: "restart", label: "Restart", icon: "arrow-clockwise", onSelect: restart, disabled: true },
    ],
    [{ kind: "toggle", id: "sound", label: "Sound", icon: "speaker-high", checked: true, onChange: sound }],
    [],
  ];
  render(<Harness sections={sections} {...o} />);
  const trigger = screen.getByRole("button", { name: "Game menu" });
  return { trigger, help, restart, sound };
}

const openWithKeyboard = (trigger: HTMLElement) => {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.getByRole("menu");
};

describe("GameMenu", () => {
  it("is a labelled 44 px button that opens a menu with icon items, a toggle and a disabled item", () => {
    const { trigger } = setup({ note: "Paused while this menu is open." });
    expect(trigger.className).toContain("size-11");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const menu = openWithKeyboard(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(within(menu).getByText("Paused while this menu is open.")).toBeTruthy();
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["How to play", "Restart"]);
    for (const i of items) {
      expect(i.querySelector("svg")).not.toBeNull();
      expect(i.className).toContain("h-12"); // 48 px rows
    }
    expect(items[1].getAttribute("aria-disabled")).toBe("true");
    const sound = within(menu).getByRole("menuitemcheckbox", { name: /Sound/ });
    expect(sound.getAttribute("aria-checked")).toBe("true");
    // Empty sections leave no stray rule: two groups, one separator.
    expect(menu.querySelectorAll("[role=separator]")).toHaveLength(1);
  });

  it("moves focus into the menu, steps with the arrow keys over disabled items, and Escape returns focus", async () => {
    const { trigger } = setup();
    const menu = openWithKeyboard(trigger);
    const [help] = within(menu).getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(help));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    // Restart is disabled, so the next stop is the Sound toggle.
    await waitFor(() => expect(document.activeElement?.getAttribute("role")).toBe("menuitemcheckbox"));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("closed"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("runs the chosen item and closes; toggles report the new value", async () => {
    const { trigger, help, sound } = setup();
    let menu = openWithKeyboard(trigger);
    fireEvent.keyDown(within(menu).getAllByRole("menuitem")[0], { key: "Enter" });
    expect(help).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("closed"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    menu = openWithKeyboard(trigger);
    fireEvent.keyDown(within(menu).getByRole("menuitemcheckbox"), { key: "Enter" });
    expect(sound).toHaveBeenCalledWith(false);
  });

  it("does not run a disabled item", () => {
    const { trigger, restart } = setup();
    const menu = openWithKeyboard(trigger);
    fireEvent.click(within(menu).getAllByRole("menuitem")[1]);
    expect(restart).not.toHaveBeenCalled();
  });

  it("hides the board behind a shield only when asked (the shell pauses then)", () => {
    const { trigger } = setup({ shield: true });
    openWithKeyboard(trigger);
    expect(document.querySelector("[data-menu-shield]")).not.toBeNull();
    cleanup();
    const again = setup({ shield: false });
    openWithKeyboard(again.trigger);
    expect(document.querySelector("[data-menu-shield]")).toBeNull();
  });

  it("only fades with reduced motion on", () => {
    const { trigger } = setup();
    act(() => useSettings.setState({ reducedMotion: "on" }));
    const menu = openWithKeyboard(trigger);
    expect(menu.style.transform).toBe("");
    expect(menu.style.opacity).toBe("0");
  });
});

describe("splitTools", () => {
  const tool = (id: string): ControlSpec => ({ id, label: id, icon: "circle", onPress: () => {} });

  it("moves Restart and Reset to the menu and keeps the rest one tap away", () => {
    const out = splitTools(["undo", "reset", "hint"].map(tool));
    expect(out.row.map((c) => c.id)).toEqual(["undo", "hint"]);
    expect(out.restart?.id).toBe("reset");
    expect(out.overflow).toEqual([]);
  });

  it("keeps at most five tools with Hint always among them; the rest go in the menu", () => {
    const out = splitTools(["a", "b", "c", "d", "hint", "e", "f"].map(tool));
    expect(out.row.map((c) => c.id)).toEqual(["a", "b", "c", "d", "hint"]);
    expect(out.overflow.map((c) => c.id)).toEqual(["e", "f"]);
    // Lost's four arrows and Hint all stay.
    expect(splitTools(["left", "up", "down", "right", "hint"].map(tool)).row).toHaveLength(5);
  });
});
