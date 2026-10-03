import test from "node:test";
import assert from "node:assert/strict";
import { dailyAppearance, resolveAppearance } from "../src/appearance.js";

test("daily cycle switches at the chosen local-time boundaries, including midnight", () => {
  for (const [h, m, s, expected] of [
    [0, 0, 0, "Night"],
    [6, 59, 59, "Night"],
    [7, 0, 0, "Day"],
    [16, 59, 59, "Day"],
    [17, 0, 0, "Planet X"],
    [20, 59, 59, "Planet X"],
    [21, 0, 0, "Night"],
    [23, 59, 59, "Night"],
  ]) {
    // Date's local constructor deliberately avoids UTC conversion of boundaries.
    const now = new Date(2026, 9, 4, h, m, s);
    assert.equal(dailyAppearance(now), expected, `${h}:${m}:${s}`);
    for (const dark of [false, true])
      assert.equal(resolveAppearance("Daily", dark, now), expected);
  }
});

test("manual and system appearances do not follow the daily clock", () => {
  for (let hour = 0; hour < 24; hour++) {
    const now = new Date(2026, 9, 4, hour);
    for (const mode of ["Day", "Night", "Planet X"])
      for (const dark of [false, true])
        assert.equal(resolveAppearance(mode, dark, now), mode);
    assert.equal(resolveAppearance("System", false, now), "Day");
    assert.equal(resolveAppearance("System", true, now), "Night");
  }
});
