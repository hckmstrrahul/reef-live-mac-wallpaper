// Independent vent clocks avoid synchronized pairs and stacked bubble necklaces.
// A vent finishes its bout before another seabed pocket starts bubbling.
export class BubbleEmission {
  constructor(sites, random = Math.random, count = 6) {
    this.sites = sites;
    this.random = random;
    this.time = 0;
    this.bursts = [];
    this.vents = Array.from(
      { length: Math.min(count, sites.length) },
      (_, i) => ({
        site: Math.floor((i * sites.length) / count),
        next: i * 0.19 + random() * 0.3,
        until: 6 + random() * 12,
        emitted: 0,
      }),
    );
  }
  radius() {
    const choice = this.random(),
      u = this.random();
    if (choice < 0.53) return 0.014 + u * 0.033;
    if (choice < 0.88) return 0.052 + u * 0.045;
    return 0.115 + u * 0.09;
  }
  burst(point, count) {
    // Immediate feedback, then a loose release over time instead of one clump.
    this.bursts.push({
      point: [...point],
      left: Math.min(28, count),
      next: this.time,
    });
    if (this.bursts.length > 12) this.bursts.shift();
  }
  tick(dt, spawn) {
    this.time += dt;
    for (const vent of this.vents) {
      if (this.time > vent.until) {
        const occupied = new Set(
          this.vents.filter((v) => v !== vent).map((v) => v.site),
        );
        const choices = this.sites
          .map((_, i) => i)
          .filter((i) => i !== vent.site && !occupied.has(i));
        if (choices.length)
          vent.site = choices[Math.floor(this.random() * choices.length)];
        vent.next = this.time + 0.8 + this.random() * 2.5;
        vent.until = vent.next + 7 + this.random() * 12;
      }
      if (this.time < vent.next) continue;
      const radius = this.radius();
      if (spawn(this.sites[vent.site], radius, false)) vent.emitted++;
      // Bigger bubbles need more room above the outlet before the next release.
      vent.next = this.time + 0.38 + this.random() * 0.8 + radius * 1.8;
    }
    for (const burst of this.bursts) {
      if (this.time < burst.next) continue;
      spawn(burst.point, this.radius(), true);
      burst.left--;
      burst.next = this.time + 0.055 + this.random() * 0.12;
    }
    this.bursts = this.bursts.filter((b) => b.left > 0);
  }
  stats() {
    return {
      sources: this.vents.map((v) => ({
        site: v.site,
        position: this.sites[v.site],
        emitted: v.emitted,
      })),
      queuedBursts: this.bursts.length,
    };
  }
}
