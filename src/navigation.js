import * as T from "three";
import { beginFishDrag, endFishDrag } from "./fish-motion.js";

export function createNavigation({
  camera,
  canvas,
  fish,
  reef,
  onClick,
  onChange,
  onFishMove,
}) {
  const target = new T.Vector3(0, 3.35, -0.8);
  const defaultDistance = 17.3 / 1.1; // 10% greater magnification at the view target.
  let distance = defaultDistance,
    yaw = 0,
    pitch = 0.0414;
  const pointers = new Map();
  let drag = null,
    pinch = null,
    gestureScale = 1;
  const ray = new T.Raycaster(),
    plane = new T.Plane(),
    point = new T.Vector3(),
    offset = new T.Vector3();
  const right = new T.Vector3(),
    up = new T.Vector3(),
    direction = new T.Vector3();
  const bounds = { minDistance: 5.5, maxDistance: 24 };
  function update() {
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    onChange();
  }
  function coords(x, y) {
    return new T.Vector2(
      (x / canvas.clientWidth) * 2 - 1,
      1 - (y / canvas.clientHeight) * 2,
    );
  }
  function hitFish(x, y) {
    ray.setFromCamera(coords(x, y), camera);
    const hits = ray.intersectObjects(
      [...fish.pickables, ...reef.interactables],
      false,
    );
    return hits[0]?.object.userData.fishIndex !== undefined
      ? fish.fishes[hits[0].object.userData.fishIndex]
      : null;
  }
  function pan(dx, dy) {
    const scale =
      (2 * distance * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) /
      canvas.clientHeight;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    target.x = T.MathUtils.clamp(target.x, -8, 8);
    target.y = T.MathUtils.clamp(target.y, 1, 7.5);
    target.z = T.MathUtils.clamp(target.z, -4, 4);
    update();
  }
  function orbit(dx, dy) {
    yaw = T.MathUtils.clamp(yaw - dx * 0.003, -0.65, 0.65);
    pitch = T.MathUtils.clamp(pitch + dy * 0.002, -0.14, 0.32);
    update();
  }
  function zoom(factor) {
    distance = T.MathUtils.clamp(
      distance * factor,
      bounds.minDistance,
      bounds.maxDistance,
    );
    update();
  }
  function down(x, y, id = 1, mode = "pan") {
    pointers.set(id, { x, y });
    if (pointers.size === 2) {
      if (drag?.fish?.dragging) endFishDrag(drag.fish);
      drag = null;
      const p = [...pointers.values()];
      pinch = {
        distance: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
        x: (p[0].x + p[1].x) / 2,
        y: (p[0].y + p[1].y) / 2,
      };
      return;
    }
    const selected = mode === "pan" ? hitFish(x, y) : null;
    drag = {
      id,
      x,
      y,
      startX: x,
      startY: y,
      moved: false,
      mode,
      fish: selected,
    };
  }
  function move(x, y, id = 1) {
    if (!pointers.has(id)) return;
    pointers.set(id, { x, y });
    if (pinch && pointers.size === 2) {
      const p = [...pointers.values()],
        d = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
        cx = (p[0].x + p[1].x) / 2,
        cy = (p[0].y + p[1].y) / 2;
      zoom(pinch.distance / Math.max(1, d));
      pan(cx - pinch.x, cy - pinch.y);
      pinch = { distance: d, x: cx, y: cy };
      return;
    }
    if (!drag || drag.id !== id) return;
    const dx = x - drag.x,
      dy = y - drag.y;
    drag.x = x;
    drag.y = y;
    drag.moved ||= Math.hypot(x - drag.startX, y - drag.startY) > 4;
    if (!drag.moved) return;
    if (drag.fish) {
      if (!drag.fish.dragging) {
        // A press is still a click until the pointer crosses the drag threshold.
        // Anchor at the fish's current position because it kept swimming meanwhile.
        beginFishDrag(drag.fish);
        camera.getWorldDirection(direction);
        plane.setFromNormalAndCoplanarPoint(
          direction,
          drag.fish.group.position,
        );
        ray.setFromCamera(coords(drag.startX, drag.startY), camera);
        ray.ray.intersectPlane(plane, point);
        offset.copy(drag.fish.group.position).sub(point);
        canvas.style.cursor = "grabbing";
      }
      ray.setFromCamera(coords(x, y), camera);
      if (ray.ray.intersectPlane(plane, point)) {
        point.add(offset);
        point.x = T.MathUtils.clamp(point.x, -8, 8);
        point.y = T.MathUtils.clamp(point.y, 0.65, 7.6);
        point.z = T.MathUtils.clamp(point.z, -7, 7.2);
        if (drag.fish.obstacles)
          drag.fish.obstacles.move(
            drag.fish.group.position,
            point,
            drag.fish.collisionRadius,
            drag.fish.group.position,
          );
        else drag.fish.group.position.copy(point);
        onFishMove(drag.fish);
        onChange();
      }
    } else if (drag.mode === "orbit") orbit(dx, dy);
    else pan(dx, dy);
  }
  function upEvent(x, y, id = 1, cancel = false) {
    pointers.delete(id);
    if (pinch) {
      pinch = null;
      drag = null;
      return;
    }
    if (drag?.id === id) {
      if (drag.fish?.dragging) endFishDrag(drag.fish);
      if (!drag.moved && !cancel)
        onClick(
          x / canvas.clientWidth,
          y / canvas.clientHeight,
          drag.fish?.index,
        );
      drag = null;
    }
    canvas.style.cursor = "grab";
  }
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    down(
      e.clientX,
      e.clientY,
      e.pointerId,
      e.button === 2 || e.altKey ? "orbit" : "pan",
    );
  });
  canvas.addEventListener("pointermove", (e) =>
    move(e.clientX, e.clientY, e.pointerId),
  );
  canvas.addEventListener("pointerup", (e) =>
    upEvent(e.clientX, e.clientY, e.pointerId),
  );
  canvas.addEventListener("pointercancel", (e) =>
    upEvent(e.clientX, e.clientY, e.pointerId, true),
  );
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(
        Math.exp(
          T.MathUtils.clamp(e.deltaY * (e.ctrlKey ? 0.008 : 0.0015), -0.3, 0.3),
        ),
      );
    },
    { passive: false },
  );
  canvas.addEventListener(
    "gesturestart",
    (e) => {
      e.preventDefault();
      gestureScale = e.scale || 1;
    },
    { passive: false },
  );
  canvas.addEventListener(
    "gesturechange",
    (e) => {
      e.preventDefault();
      zoom(gestureScale / e.scale);
      gestureScale = e.scale;
    },
    { passive: false },
  );
  canvas.addEventListener("gestureend", (e) => e.preventDefault(), {
    passive: false,
  });
  update();
  return {
    update,
    zoom,
    pan,
    reset() {
      target.set(0, 3.35, -0.8);
      distance = defaultDistance;
      yaw = 0;
      pitch = 0.0414;
      update();
    },
    state: () => ({
      target: target.toArray(),
      distance,
      yaw,
      pitch,
      draggingFish: drag?.moved ? (drag.fish?.index ?? null) : null,
    }),
    pointer: (phase, x, y) => {
      const px = x * canvas.clientWidth,
        py = y * canvas.clientHeight;
      if (phase === "down") down(px, py);
      if (phase === "move") move(px, py);
      if (phase === "up") upEvent(px, py);
      if (phase === "cancel") upEvent(px, py, 1, true);
    },
  };
}
