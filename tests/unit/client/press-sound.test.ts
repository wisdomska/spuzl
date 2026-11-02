// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { pressSound, SOFT_PRESS_GAIN } from "@/lib/audio/press";

function dom(html: string) {
  document.body.innerHTML = html;
  return (sel: string) => document.querySelector(sel);
}

describe("pressSound", () => {
  it("taps on buttons and on links styled as buttons, not on text links", () => {
    const $ = dom(`<button id="b"><span id="in">Go</span></button><a id="toy" class="press x" href="/a">A</a><a id="text" href="/b">B</a>`);
    expect(pressSound($("#in"))).toEqual({ event: "tap" });
    expect(pressSound($("#toy"))).toEqual({ event: "tap" });
    expect(pressSound($("#text"))).toBeNull();
  });

  it("stays quiet on disabled controls, cells and opted-out controls", () => {
    const $ = dom(
      `<button id="d" disabled>x</button><div role="gridcell"><button id="c">1</button></div><div data-no-tick><button id="n">n</button></div>`,
    );
    expect(pressSound($("#d"))).toBeNull();
    expect(pressSound($("#c"))).toBeNull();
    expect(pressSound($("#n"))).toBeNull();
  });

  it("toggles up when a switch turns on and down when it turns off", () => {
    const $ = dom(
      `<button id="off" role="switch" aria-checked="false" data-no-tick></button><button id="on" role="switch" aria-checked="true"></button>`,
    );
    expect(pressSound($("#off"))).toEqual({ event: "toggle", step: 1 });
    expect(pressSound($("#on"))).toEqual({ event: "toggle", step: 0 });
  });

  it("toggles on board tool modes and taps softly on take-back controls", () => {
    const $ = dom(
      `<button id="m0" data-press="toggle" aria-pressed="false">Fill</button><button id="m1" data-press="toggle" aria-pressed="true">Notes</button>
       <button id="u" data-press="soft">Undo</button><button id="chip" aria-pressed="true">All</button>
       <div role="gridcell"><button id="cell" data-press="soft">1</button></div>`,
    );
    expect(pressSound($("#m0"))).toEqual({ event: "toggle", step: 1 });
    expect(pressSound($("#m1"))).toEqual({ event: "toggle", step: 0 });
    expect(pressSound($("#u"))).toEqual({ event: "tap", gain: SOFT_PRESS_GAIN });
    expect(pressSound($("#chip"))).toEqual({ event: "tap" });
    expect(pressSound($("#cell"))).toBeNull();
  });

  it("taps on menu items and toggles on menu checkboxes (Radix items are not buttons)", () => {
    const $ = dom(
      `<div role="menu"><div id="i" role="menuitem"><span id="ic">Restart</span></div><div id="x" role="menuitem" aria-disabled="true">x</div>
       <div id="s0" role="menuitemcheckbox" aria-checked="false">Sound</div><div id="s1" role="menuitemcheckbox" aria-checked="true">Haptics</div>
       <div id="r0" role="menuitemradio" aria-checked="false">Hard</div><div id="r1" role="menuitemradio" aria-checked="true">Easy</div></div>`,
    );
    expect(pressSound($("#ic"))).toEqual({ event: "tap" });
    expect(pressSound($("#x"))).toBeNull();
    expect(pressSound($("#s0"))).toEqual({ event: "toggle", step: 1 });
    expect(pressSound($("#s1"))).toEqual({ event: "toggle", step: 0 });
    expect(pressSound($("#r0"))).toEqual({ event: "tap" });
    expect(pressSound($("#r1"))).toBeNull();
  });

  it("plays the nav sound for a new tab or nav item, nothing for the current one", () => {
    const $ = dom(
      `<div role="tablist"><button id="t1" role="tab" aria-selected="true"></button><button id="t2" role="tab" aria-selected="false"></button></div>
       <nav><a id="here" href="/" aria-current="page">Grid</a><a id="there" href="/shop">Shop</a></nav>`,
    );
    expect(pressSound($("#t1"))).toBeNull();
    expect(pressSound($("#t2"))).toEqual({ event: "nav" });
    expect(pressSound($("#here"))).toBeNull();
    expect(pressSound($("#there"))).toEqual({ event: "nav" });
  });

  it("ignores presses on plain content", () => {
    const $ = dom(`<p id="p">text</p>`);
    expect(pressSound($("#p"))).toBeNull();
    expect(pressSound(null)).toBeNull();
  });
});
