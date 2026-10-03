// Adjust pixels, never elapsed swimming time, texture detail or scene contents.
// A long recovery window prevents resolution oscillation near the frame budget.
export class AdaptiveResolution {
  constructor(ceiling = 1.5) {
    this.reset(ceiling);
  }
  reset(ceiling = this.ceiling) {
    this.ceiling = ceiling;
    this.floor = Math.min(1, ceiling);
    this.scale = ceiling;
    this.seconds = 0;
    this.frames = 0;
    this.stableSeconds = 0;
  }
  sample(dt) {
    if (!(dt > 0) || dt > 0.1) return null;
    this.seconds += dt;
    this.frames++;
    if (this.seconds < 1.6 || this.frames < 24) return null;
    const mean = this.seconds / this.frames;
    let next = this.scale;
    if (mean > 0.0195) {
      next = Math.max(
        this.floor,
        Math.floor(this.scale * Math.sqrt(0.0165 / mean) * 20) / 20,
      );
      this.stableSeconds = 0;
    } else if (mean < 0.0174) {
      this.stableSeconds += this.seconds;
      if (this.stableSeconds > 24) {
        next = Math.min(this.ceiling, this.scale + 0.05);
        this.stableSeconds = 0;
      }
    } else this.stableSeconds = 0;
    this.seconds = 0;
    this.frames = 0;
    if (Math.abs(next - this.scale) < 0.025) return null;
    this.scale = next;
    return next;
  }
}
