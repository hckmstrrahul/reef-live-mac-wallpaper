/** Coarse 3D incompressible Eulerian current field: semi-Lagrangian advection,
 * Jacobi pressure projection and impermeable box walls. World units are metres.
 * The separate MIT GPU water solver handles the free surface. This field is a
 * visual approximation, not a research-grade multiphase CFD solver. */
export class CurrentField {
  constructor(nx = 24, ny = 12, nz = 12) {
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.h = 0.8;
    this.size = nx * ny * nz;
    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
    this.w = new Float32Array(this.size);
    this.a = new Float32Array(this.size);
    this.b = new Float32Array(this.size);
    this.c = new Float32Array(this.size);
    this.p = new Float32Array(this.size);
    this.q = new Float32Array(this.size);
    this.div = new Float32Array(this.size);
    this.sampleBuffer = [0, 0, 0];
  }
  index(x, y, z) {
    return x + this.nx * (y + this.ny * z);
  }
  interp(f, x, y, z) {
    x = Math.max(0, Math.min(this.nx - 1.001, x));
    y = Math.max(0, Math.min(this.ny - 1.001, y));
    z = Math.max(0, Math.min(this.nz - 1.001, z));
    const ix = x | 0,
      iy = y | 0,
      iz = z | 0,
      fx = x - ix,
      fy = y - iy,
      fz = z - iz;
    let s = 0;
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++)
          s +=
            f[this.index(ix + i, iy + j, iz + k)] *
            (i ? fx : 1 - fx) *
            (j ? fy : 1 - fy) *
            (k ? fz : 1 - fz);
    return s;
  }
  sample(x, y, z, out = this.sampleBuffer) {
    const gx = (x + 9.6) / this.h,
      gy = y / this.h,
      gz = (z + 6.4) / this.h;
    out[0] = this.interp(this.u, gx, gy, gz);
    out[1] = this.interp(this.v, gx, gy, gz);
    out[2] = this.interp(this.w, gx, gy, gz);
    return out;
  }
  impulse(x, y, z, vx, vy, vz, radius = 1.3) {
    const gx = (x + 9.6) / this.h,
      gy = y / this.h,
      gz = (z + 6.4) / this.h,
      r = radius / this.h;
    for (
      let k = Math.max(1, Math.floor(gz - r));
      k < Math.min(this.nz - 1, gz + r);
      k++
    )
      for (
        let j = Math.max(1, Math.floor(gy - r));
        j < Math.min(this.ny - 1, gy + r);
        j++
      )
        for (
          let i = Math.max(1, Math.floor(gx - r));
          i < Math.min(this.nx - 1, gx + r);
          i++
        ) {
          const d = ((i - gx) ** 2 + (j - gy) ** 2 + (k - gz) ** 2) / (r * r);
          if (d > 1) continue;
          const n = this.index(i, j, k),
            s = (1 - d) ** 2;
          this.u[n] += vx * s;
          this.v[n] += vy * s;
          this.w[n] += vz * s;
        }
  }
  boundary() {
    const { nx, ny, nz } = this;
    for (let z = 0; z < nz; z++)
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          const i = this.index(x, y, z);
          if (x === 0 || x === nx - 1) this.u[i] = 0;
          if (y === 0 || y === ny - 1) this.v[i] = 0;
          if (z === 0 || z === nz - 1) this.w[i] = 0;
        }
  }
  project(iterations = 20) {
    const { nx, ny, nz, h } = this;
    this.boundary();
    this.p.fill(0);
    this.q.fill(0);
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const n = this.index(x, y, z);
          this.div[n] =
            (this.u[n + 1] -
              this.u[n - 1] +
              this.v[n + nx] -
              this.v[n - nx] +
              this.w[n + nx * ny] -
              this.w[n - nx * ny]) /
            (2 * h);
        }
    for (let t = 0; t < iterations; t++) {
      for (let z = 1; z < nz - 1; z++)
        for (let y = 1; y < ny - 1; y++)
          for (let x = 1; x < nx - 1; x++) {
            const n = this.index(x, y, z);
            this.q[n] =
              (this.p[n - 1] +
                this.p[n + 1] +
                this.p[n - nx] +
                this.p[n + nx] +
                this.p[n - nx * ny] +
                this.p[n + nx * ny] -
                h * h * this.div[n]) /
              6;
          }
      [this.p, this.q] = [this.q, this.p];
    }
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const n = this.index(x, y, z);
          this.u[n] -= (this.p[n + 1] - this.p[n - 1]) / (2 * h);
          this.v[n] -= (this.p[n + nx] - this.p[n - nx]) / (2 * h);
          this.w[n] -= (this.p[n + nx * ny] - this.p[n - nx * ny]) / (2 * h);
        }
    this.boundary();
  }
  step(dt) {
    dt = Math.min(dt, 1 / 30);
    const { nx, ny, nz, h } = this;
    for (let z = 0; z < nz; z++)
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          const n = this.index(x, y, z),
            px = x - (this.u[n] * dt) / h,
            py = y - (this.v[n] * dt) / h,
            pz = z - (this.w[n] * dt) / h;
          this.a[n] = this.interp(this.u, px, py, pz) * 0.998;
          this.b[n] = this.interp(this.v, px, py, pz) * 0.998;
          this.c[n] = this.interp(this.w, px, py, pz) * 0.998;
        }
    [this.u, this.a] = [this.a, this.u];
    [this.v, this.b] = [this.b, this.v];
    [this.w, this.c] = [this.c, this.w];
    this.project();
  }
  divergence() {
    let sum = 0,
      count = 0;
    for (let z = 1; z < this.nz - 1; z++)
      for (let y = 1; y < this.ny - 1; y++)
        for (let x = 1; x < this.nx - 1; x++) {
          const n = this.index(x, y, z),
            s = this.nx,
            t = s * this.ny;
          const d =
            (this.u[n + 1] -
              this.u[n - 1] +
              this.v[n + s] -
              this.v[n - s] +
              this.w[n + t] -
              this.w[n - t]) /
            (2 * this.h);
          sum += d * d;
          count++;
        }
    return Math.sqrt(sum / count);
  }
}
