const MODES = ["System", "Daily", "Day", "Night", "Planet X"];
export function dailyAppearance(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 7 && hour < 17) return "Day";
  if (hour >= 17 && hour < 21) return "Planet X";
  return "Night";
}
export function resolveAppearance(mode, systemDark, now = new Date()) {
  if (mode === "Daily") return dailyAppearance(now);
  if (mode === "Planet X") return mode;
  return mode === "Night" || (mode === "System" && systemDark)
    ? "Night"
    : "Day";
}
export function createAppearance(onChange) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  let mode = "System",
    systemDark = media.matches,
    applied;
  try {
    const saved = localStorage.getItem("reef.appearance");
    if (MODES.includes(saved)) mode = saved;
  } catch {}
  function apply() {
    const resolved = resolveAppearance(mode, systemDark);
    applied = resolved;
    document.documentElement.dataset.appearance = resolved
      .toLowerCase()
      .replaceAll(" ", "-");
    document.querySelector("#appearance").value = mode;
    document.querySelector("#appearance").title =
      mode === "Daily"
        ? "Local time: Daylight 7 AM–5 PM · Planet X 5–9 PM · UV Night 9 PM–7 AM"
        : "Aquarium appearance";
    onChange(resolved);
  }
  // Resolve from the wall clock, never elapsed animation time. Sleep, pause,
  // clock changes and travel across time zones cannot accumulate schedule drift.
  function refresh() {
    if (resolveAppearance(mode, systemDark) !== applied) apply();
  }
  setInterval(() => {
    if (mode === "Daily") refresh();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  addEventListener("pageshow", refresh);
  addEventListener("focus", refresh);
  function set(value, fromHost = false) {
    if (!MODES.includes(value)) return;
    mode = value;
    try {
      localStorage.setItem("reef.appearance", mode);
    } catch {}
    apply();
    if (!fromHost)
      window.webkit?.messageHandlers?.reef?.postMessage({
        event: "appearance",
        mode,
      });
  }
  media.addEventListener("change", (event) => {
    systemDark = event.matches;
    if (mode === "System") apply();
  });
  addEventListener("storage", (event) => {
    if (event.key === "reef.appearance" && MODES.includes(event.newValue)) {
      mode = event.newValue;
      apply();
    }
  });
  document
    .querySelector("#appearance")
    .addEventListener("change", (e) => set(e.target.value));
  return {
    set,
    apply,
    refresh,
    state: () => ({
      mode,
      resolved: applied ?? resolveAppearance(mode, systemDark),
      systemDark,
    }),
  };
}
