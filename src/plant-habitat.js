import * as T from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

// Triangle-level placement checks happen once during planting. BVHs are shared
// by repeated specimen geometry; runtime plant sway remains entirely on the GPU.
export class PlantHabitat {
  constructor(ground, corals) {
    this.ground = ground;
    this.corals = corals.map((mesh) => {
      mesh.updateWorldMatrix(true, false);
      return {
        mesh,
        box: new T.Box3().setFromObject(mesh),
        inverse: mesh.matrixWorld.clone().invert(),
      };
    });
    for (const mesh of [...ground, ...corals]) {
      if (!mesh.geometry.boundsTree)
        mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
      mesh.raycast = acceleratedRaycast;
    }
    this.ray = new T.Raycaster();
    this.ray.firstHitOnly = true;
    this.box = new T.Box3();
    this.matrix = new T.Matrix4();
    this.translation = new T.Matrix4();
    this.queries = 0;
    this.intersections = 0;
  }
  height(x, z) {
    this.ray.set(new T.Vector3(x, 12, z), new T.Vector3(0, -1, 0));
    return this.ray.intersectObjects(this.ground, false)[0]?.point.y ?? 0;
  }
  clear(geometry, root) {
    geometry.computeBoundingBox();
    this.box.copy(geometry.boundingBox).translate(root).expandByScalar(0.15);
    // Test a small sway envelope as well as the rest position. A frond is
    // rejected whole if it crosses tissue; bounding boxes only prune queries.
    for (const entry of this.corals) {
      if (!this.box.intersectsBox(entry.box)) continue;
      if (!geometry.boundsTree) geometry.boundsTree = new MeshBVH(geometry);
      for (const [x, z] of [
        [0, 0],
        [-0.14, 0],
        [0.14, 0],
        [0, -0.08],
        [0, 0.08],
        [-0.1, -0.06],
        [0.1, 0.06],
      ]) {
        this.translation.makeTranslation(root.x + x, root.y, root.z + z);
        this.matrix.multiplyMatrices(entry.inverse, this.translation);
        this.queries++;
        if (
          entry.mesh.geometry.boundsTree.intersectsGeometry(
            geometry,
            this.matrix,
          )
        ) {
          this.intersections++;
          return false;
        }
      }
    }
    return true;
  }
}
