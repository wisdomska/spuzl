// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { pressSound } from "@/lib/audio/press";

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
