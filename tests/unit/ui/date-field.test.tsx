// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Calendar,
  DateField,
  DateTimeField,
  addMonths,
  formatYmd,
  monthWeeks,
  parseYmd,
  timeOptions,
  weekday,
  ymdString,
} from "@/components/ui/DateField";

/** R7: the app's date field (a calendar popover) in place of the browser's date input. Values stay YYYY-MM-DD. */
afterEach(cleanup);

describe("date helpers", () => {
  it("parses only real calendar days", () => {
    expect(parseYmd("2026-11-11")).toEqual({ y: 2026, m: 11, d: 11 });
    expect(parseYmd("2026-02-29")).toBeNull();
    expect(parseYmd("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseYmd("")).toBeNull();
    expect(parseYmd("11/11/2026")).toBeNull();
    expect(ymdString({ y: 2026, m: 1, d: 5 })).toBe("2026-01-05");
  });

  it("weeks start on Monday and fill the grid from the months either side", () => {
    // 1 Nov 2026 is a Sunday
    expect(weekday({ y: 2026, m: 11, d: 1 })).toBe(6);
    const weeks = monthWeeks(2026, 11);
    expect(weeks[0][0]).toEqual({ y: 2026, m: 10, d: 26 });
    expect(weeks[0][6]).toEqual({ y: 2026, m: 11, d: 1 });
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // Feb 2027 starts on a Monday and has 28 days: exactly 4 rows
    expect(monthWeeks(2027, 2)).toHaveLength(4);
  });

  it("adds months keeping the day where it fits", () => {
    expect(addMonths({ y: 2026, m: 1, d: 31 }, 1)).toEqual({ y: 2026, m: 2, d: 28 });
    expect(addMonths({ y: 2026, m: 12, d: 15 }, 1)).toEqual({ y: 2027, m: 1, d: 15 });
    expect(addMonths({ y: 2026, m: 1, d: 15 }, -12)).toEqual({ y: 2025, m: 1, d: 15 });
  });

  it("formats for people", () => {
    expect(formatYmd({ y: 2026, m: 11, d: 11 })).toBe("Wed 11 Nov 2026");
  });

  it("time options are every half hour and keep an off-grid saved time", () => {
    expect(timeOptions()).toHaveLength(48);
    const kept = timeOptions("09:10").map((o) => o.value);
    expect(kept).toContain("09:10");
    expect(kept.indexOf("09:10")).toBe(kept.indexOf("09:00") + 1);
  });
});

function Field({
  initial = "",
  onChange = () => {},
  ...rest
}: {
  initial?: string;
  onChange?: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const [v, setV] = useState(initial);
  return (
    <>
      <label htmlFor="from">From</label>
      <DateField
        id="from"
        clearable
        value={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        {...rest}
      />
    </>
  );
}

describe("DateField", () => {
  it("is a button named by its label, showing the date in words or a placeholder", () => {
    render(<Field initial="2026-11-11" />);
    const t = screen.getByRole("button", { name: "From" });
    expect(t.textContent).toContain("Wed 11 Nov 2026");
    expect(t.getAttribute("data-value")).toBe("2026-11-11");
    cleanup();
    render(<Field />);
    expect(screen.getByRole("button", { name: "From" }).textContent).toContain("Pick a date");
  });

  it("opens a calendar on the chosen day; a click picks and closes", () => {
    const onChange = vi.fn();
    render(<Field initial="2026-11-11" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "From" }));
    const grid = screen.getByRole("grid", { name: "November 2026" });
    const day = screen.getByRole("button", { name: "Wednesday 11 November 2026" });
    expect(grid.contains(day)).toBe(true);
    expect(day.getAttribute("tabindex")).toBe("0");
    expect(day.closest("td")?.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Friday 20 November 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-20");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("Clear empties a filter", () => {
    const onChange = vi.fn();
    render(<Field initial="2026-11-11" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "From" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("days outside min and max can't be picked", () => {
    render(<Field initial="2026-11-11" min="2026-11-05" max="2026-11-20" />);
    fireEvent.click(screen.getByRole("button", { name: "From" }));
    expect((screen.getByRole("button", { name: "Wednesday 4 November 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Saturday 21 November 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Thursday 5 November 2026" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Calendar keyboard", () => {
  const today = { y: 2026, m: 11, d: 11 };
  const setup = () => {
    const onPick = vi.fn();
    render(<Calendar value={today} today={today} onPick={onPick} />);
    const grid = screen.getByRole("grid");
    const focused = () => document.activeElement?.getAttribute("aria-label");
    act(() => screen.getByRole("button", { name: "Wednesday 11 November 2026" }).focus());
    const key = (k: string, shiftKey = false) => fireEvent.keyDown(grid, { key: k, shiftKey });
    return { onPick, key, focused };
  };

  it("arrows move a day or a week; Home and End go to the week's ends", () => {
    const { key, focused } = setup();
    key("ArrowRight");
    expect(focused()).toBe("Thursday 12 November 2026");
    key("ArrowDown");
    expect(focused()).toBe("Thursday 19 November 2026");
    key("ArrowLeft");
    key("ArrowUp");
    expect(focused()).toBe("Wednesday 11 November 2026");
    key("Home");
    expect(focused()).toBe("Monday 9 November 2026");
    key("End");
    expect(focused()).toBe("Sunday 15 November 2026");
  });

  it("Page Up and Page Down change month (Shift: year) and the heading follows", () => {
    const { key, focused } = setup();
    key("PageDown");
    expect(focused()).toBe("Friday 11 December 2026");
    expect(screen.getByRole("grid", { name: "December 2026" })).toBeTruthy();
    key("PageUp", true);
    expect(focused()).toBe("Thursday 11 December 2025");
  });

  it("the month buttons move the view", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "December 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeTruthy();
  });

  it("today is marked for screen readers", () => {
    setup();
    expect(screen.getByRole("button", { name: "Wednesday 11 November 2026" }).getAttribute("aria-current")).toBe("date");
  });
});

describe("DateTimeField", () => {
  it("keeps the datetime-local shape: picking a date keeps the time; the time is named after the field", () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="start">Starts</label>
        <DateTimeField id="start" label="Starts" value="2026-11-11T18:30" onChange={onChange} />
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Starts, time" }).textContent).toContain("18:30");
    fireEvent.click(screen.getByRole("button", { name: "Starts" }));
    fireEvent.click(screen.getByRole("button", { name: "Friday 13 November 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-13T18:30");
  });
});
