import * as T from "three";

// Lower a colony until its actual underside touches a supporting rock. Bounding
// boxes alone are insufficient for the irregular, tilted specimen scans.
export function settleOnMesh(object, support, embed = 0.035) {
  object.updateWorldMatrix(true, true);
  support.updateWorldMatrix(true, false);
  const top = new T.Box3().setFromObject(object).max.y + 3;
  const ray = new T.Raycaster(),
    point = new T.Vector3(),
    down = new T.Vector3(0, -1, 0);
  let gap = Infinity,
    contacts = 0;
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    const step = Math.max(1, Math.floor(positions.count / 800));
    for (let i = 0; i < positions.count; i += step) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const y = point.y;
      point.y = top;
      ray.set(point, down);
      const hit = ray.intersectObject(support, false)[0];
      if (!hit) continue;
      gap = Math.min(gap, y - hit.point.y);
      contacts++;
    }
  });
  if (!Number.isFinite(gap))
    throw new Error("Coral has no supporting surface beneath it");
  object.position.y -= gap + embed;
  object.updateWorldMatrix(true, true);
  return { contacts, loweredBy: gap + embed, gapAfter: -embed };
}
