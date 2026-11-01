// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountUp, countEase } from "@/components/results/CountUp";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CountUp", () => {
  it("shows the final value at once when instant (reduced motion or a skip)", () => {
    const { container } = render(<CountUp value={120} format={(n) => `+${Math.round(n)}`} instant />);
    expect(container.textContent).toBe("+120");
  });

  it("counts from zero to the value without re-rendering", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    let renders = 0;
    const fmt = (n: number) => {
      renders++;
      return `${Math.round(n)}`;
    };
    const { container } = render(<CountUp value={50} format={fmt} instant={false} duration={300} />);
    expect(container.textContent).toBe("0");
    act(() => vi.advanceTimersByTime(150));
    const mid = Number(container.textContent);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(50);
    act(() => vi.advanceTimersByTime(400));
    expect(container.textContent).toBe("50");
    // format runs per frame, but the component rendered once
    expect(renders).toBeGreaterThan(2);
  });

  it("eases out: more than half way at the half-time mark", () => {
    expect(countEase(0)).toBe(0);
    expect(countEase(0.5)).toBeGreaterThan(0.5);
    expect(countEase(1)).toBe(1);
  });
});
