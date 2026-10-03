// Deliberate reef terraces around an open, receding swim corridor. Coordinates
// are in metres; each colony is rooted into the crest of its supporting rock.
export function arrangeReef({
  rock,
  branchCoral,
  sponge,
  softCoral,
  plates,
  brain,
  polypMound,
  giantClam,
}) {
  for (const [x, y, z, sx, sy, sz] of [
    [-8.6, 2.3, -3, 2.6, 3.9, 2.2],
    [-6.7, 1.3, -1.5, 2.3, 2.1, 1.7],
    [-8, 0.8, 2, 2.9, 1.7, 2.0],
    [-5.1, 0.35, 2.8, 2.5, 0.8, 1.8],
    [-5.2, 0.7, -4.5, 1.8, 1.3, 1.5],
    [-8, 3, -6, 2.2, 3.1, 1.9],
    [7.4, 1.2, -2.7, 2.5, 2.4, 2.1],
    [5.8, 0.65, 0.1, 2.1, 1.4, 1.7],
    [7.7, 0.7, 3.3, 2.3, 1.35, 1.8],
    [3.7, 0.4, 2.9, 2, 0.8, 1.6],
    [4.1, 0.2, -2.5, 1.8, 0.65, 1.3],
    [-3.8, 0.13, 4.5, 2.2, 0.4, 1.3],
    [-7.2, 1.9, -11, 2.6, 3.0, 2.2],
    [6.9, 1.7, -11.5, 2.4, 2.8, 2.2],
    [-3.9, 0.8, -15.8, 1.8, 1.5, 2],
    [3.8, 1, -17, 2, 2, 1.9],
    [-9.7, 0.6, 5.5, 2, 1.2, 2],
    [9.3, 0.8, 5.7, 2.4, 1.3, 1.8],
  ])
    rock(x, y, z, sx, sy, sz);
  // Keep the existing colony seeds while adding a grounded supporting ledge.
  rock(2.85, 0.38, 0.85, 1.48, 0.8, 0.95, true);
  // High left bank, with shelves and pale soft growth catching the overhead light.
  plates(-7.6, 5.25, -3.5, 2.0, "#a5b06c");
  plates(-6.6, 3.45, -1.8, 1.65, "#8e7dac");
  plates(-6.0, 1.55, 1.0, 1.5, "#b191a5");
  softCoral(-7.8, 4.5, -3.1, 1.9, "#93b5ae");
  softCoral(-7.4, 3.55, -1.3, 1.5, "#819fa3");
  softCoral(-8.7, 2.0, 0.6, 1.7, "#8d82a8");
  branchCoral(-5.6, 2.55, -4.5, 2.0, "#b9b688", "finger");
  softCoral(-5.7, 2.0, -2, 1.7, "#85b9aa");
  softCoral(-4.8, 0.62, 2.1, 2.0, "#d7b8a5");
  branchCoral(-7.5, 1.0, 3.2, 4.0, "#62548f", "fan");
  branchCoral(-8.7, 3.1, -5.1, 2.8, "#508a87", "staghorn");
  branchCoral(-3.8, 0.38, 4.5, 1.9, "#9eac48", "finger");
  sponge(-2.9, 0.1, 2.8, 3.6, "#c65283");
  sponge(-8.3, 1.6, 0.4, 1.55, "#7a6fa5");
  polypMound(-7.1, 1.2, 1.4, 1.3, "#60938a", "#a5bb9c");
  // Golden focal shelf, cool lower ledges and smaller warm colonies at the right.
  plates(2.85, 1.05, 0.85, 1.65, "#e7bf6f", true);
  plates(6.0, 2.3, -2.5, 1.75, "#96a58f");
  plates(6.9, 1.1, 1.8, 1.4, "#a29dbd");
  softCoral(5.0, 1.55, -0.55, 1.7, "#cd738c");
  softCoral(7.5, 2.9, -2.2, 1.8, "#a99cb8");
  branchCoral(7.9, 2.1, 0.4, 2.1, "#91a3a0", "table");
  softCoral(6.3, 0.95, 3.5, 1.6, "#e0bba7");
  branchCoral(4.4, 0.5, 3, 2.0, "#94a34b", "finger");
  branchCoral(6.9, 0.7, 4.8, 2.1, "#bc8aa9", "finger");
  branchCoral(4.6, 0.4, -2.0, 3.2, "#966177", "fan");
  sponge(7.7, 1.2, 3.2, 1.05, "#4a94b2");
  brain(3.4, 0.78, 3.65, 0.65, "#86786b", "#bbae8c");
  brain(-6.4, 1.1, 2.7, 0.6, "#667f72", "#afbaa2");
  polypMound(5.1, 0.8, 1.8, 0.72, "#a57270", "#d1b28a");
  // Distant shelves fade into blue water instead of a solid wall of ornaments.
  for (const side of [-1, 1]) {
    plates(side * 7, 3, -11.5, 2.2, "#65928d");
    plates(side * 6.5, 1.65, -10.3, 2.5, "#72928c");
    softCoral(side * 6.7, 3.4, -12, 1.8, "#5b8e91");
    branchCoral(side * 7.7, 2.2, -13, 3.5, "#638e98", "fan");
    branchCoral(side * 4.6, 0.4, -9.4, 1.7, "#839b8b", "table");
    plates(side * 4.2, 1.4, -16, 1.8, "#668d87");
  }
  rock(0.7, 0.05, -3.5, 0.9, 0.19, 0.55);
  giantClam(0.7, 0.2, -3.5, 0.7);
}
