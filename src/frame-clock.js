// Fish follow elapsed active time, even when a costly frame misses a refresh.
// Only Eco throttles presentation; its fractional frame budget is retained.
export class FrameClock {
  constructor() {
    this.suspend();
  }
  suspend() {
    this.previous = null;
    this.pending = 0;
    this.budget = 0;
  }
  tick(now, active = true, fps = 0) {
    if (!active) {
      this.suspend();
      return null;
    }
    if (this.previous === null) {
      this.previous = now;
      return 0;
    }
    const elapsed = Math.max(0, (now - this.previous) / 1000);
    this.previous = now;
    // Treat OS/browser suspension as a discontinuity, not a giant catch-up jump.
    if (elapsed > 1) {
      this.pending = this.budget = 0;
      return 0;
    }
    this.pending += elapsed;
    this.budget += elapsed;
    if (fps > 0) {
      const period = 1 / fps;
      if (this.budget + 1e-7 < period) return null;
      const periods = Math.floor((this.budget + 1e-7) / period);
      this.budget = Math.max(0, this.budget - periods * period);
    } else this.budget = 0;
    const dt = this.pending;
    this.pending = 0;
    return dt;
  }
}
export class FixedStepper {
  constructor(hz = 30, maxSteps = 3) {
    this.step = 1 / hz;
    this.maxSteps = maxSteps;
    this.remaining = 0;
  }
  advance(dt, simulate) {
    this.remaining += dt;
    const count = Math.min(
      this.maxSteps,
      Math.floor((this.remaining + 1e-9) / this.step),
    );
    for (let i = 0; i < count; i++) simulate(this.step);
    this.remaining = Math.max(0, this.remaining - count * this.step);
    // Expensive fluid work cannot create an unbounded catch-up spiral.
    if (this.remaining >= this.step) this.remaining %= this.step;
    return count;
  }
}
