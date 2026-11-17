import * as THREE from 'three';
import { Octree } from '../../pustaka/Octree.js';
import { Capsule } from '../../pustaka/Capsule.js';

export class PlayerController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.octree = new Octree();
    this.capsule = new Capsule(
      new THREE.Vector3(-2.5, 0.45, 2.5),
      new THREE.Vector3(-2.5, 1.53, 2.5),
      0.18
    );

    this.mode = 'tour'; // 'tour' | 'walk' | 'dollhouse'
    this.keys = Object.create(null);
    this.velocity = new THREE.Vector3();
    this.isGrounded = false;
    this.yaw = 0;
    this.pitch = 0;
    this.eyeHeight = 1.25; // capsule.end -> top of 1.65m eye level from capsule center
    this.isDragging = false;
    this.isPointerLocked = false;
    this.lastPointer = { x: 0, y: 0 };

    // Glide tween state for tour transitions
    this.tween = null;
    this.onUserInteract = null;

    this._bindEvents();
  }

  buildCollider(colliderScene) {
    this.octree.fromGraphNode(colliderScene);
  }

  _bindEvents() {
    const dom = this.domElement;

    dom.addEventListener('pointerdown', (e) => {
      if (this.mode === 'dollhouse' || e.button !== 0) return;
      this.isDragging = true;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (this.mode === 'dollhouse') return;
      if (this.isPointerLocked) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * 0.0022));
        this.tween = null;
        this.onUserInteract?.();
      } else if (this.isDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer.x = e.clientX;
        this.lastPointer.y = e.clientY;
        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
          this.yaw += dx * 0.0032;
          this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch + dy * 0.0032));
          this.tween = null;
          this.onUserInteract?.();
        }
      }
    });

    dom.addEventListener('wheel', (e) => {
      if (this.mode !== 'tour') return;
      const nextFov = THREE.MathUtils.clamp(this.camera.fov + e.deltaY * 0.025, 40, 82);
      if (nextFov !== this.camera.fov) {
        this.camera.fov = nextFov;
        this.camera.updateProjectionMatrix();
      }
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  requestPointerLock() {
    if (document.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock?.();
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  setMode(nextMode) {
    this.mode = nextMode;
    this.tween = null;
    this.velocity.set(0, 0, 0);
    if (nextMode !== 'walk') {
      this.exitPointerLock();
    } else {
      this.syncCapsuleFromCamera();
    }
  }

  syncCapsuleFromCamera() {
    const pos = this.camera.position;
    const baseY = Math.max(0.15, pos.y - 1.50);
    this.capsule.start.set(pos.x, baseY + 0.18, pos.z);
    this.capsule.end.set(pos.x, baseY + 1.38, pos.z);
  }

  _yawPitchFromLook(fromVec, toVec) {
    const dir = new THREE.Vector3().subVectors(toVec, fromVec).normalize();
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -0.99, 0.99));
    return { yaw, pitch };
  }

  glideToPose(eyeArr, targetArr, fov = 64, durationMs = 950) {
    const fromPos = this.camera.position.clone();
    const toPos = new THREE.Vector3(...eyeArr);
    const toTarget = new THREE.Vector3(...targetArr);
    const startFov = this.camera.fov;
    const { yaw: endYaw, pitch: endPitch } = this._yawPitchFromLook(toPos, toTarget);

    // Shortest angular interpolation on yaw
    let startYaw = this.yaw;
    while (endYaw - startYaw > Math.PI) startYaw += Math.PI * 2;
    while (endYaw - startYaw < -Math.PI) startYaw -= Math.PI * 2;

    if (durationMs <= 0) {
      this.camera.position.copy(toPos);
      this.yaw = endYaw;
      this.pitch = endPitch;
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this._applyEuler();
      this.syncCapsuleFromCamera();
      return;
    }

    this.tween = {
      startTime: performance.now(),
      duration: durationMs,
      fromPos,
      toPos,
      startYaw,
      endYaw,
      startPitch: this.pitch,
      endPitch,
      startFov,
      endFov: fov,
    };
  }

  teleportToXZ(x, z) {
    const floorY = z > -0.2 ? 0.0 : z > -4.5 ? 0.10 : 0.15;
    this.tween = null;
    this.velocity.set(0, 0, 0);
    // Probe waist-to-head capsule so clicking a table/island nudges horizontally onto walkable floor (never atop furniture!)
    this.capsule.start.set(x, floorY + 0.55, z);
    this.capsule.end.set(x, floorY + 1.38, z);
    for (let k = 0; k < 6; k++) {
      const res = this.octree.capsuleIntersect(this.capsule);
      if (!res) break;
      const horiz = new THREE.Vector3(res.normal.x, 0, res.normal.z);
      if (horiz.lengthSq() > 1e-4) {
        horiz.normalize().multiplyScalar(res.depth + 0.04);
        this.capsule.translate(horiz);
      } else {
        // Clicked dead-center on a low table top: step cleanly along +X or -Z toward walkway
        this.capsule.translate(new THREE.Vector3(0.45, 0, 0));
      }
    }
    this.capsule.start.y = floorY + 0.18;
    this.capsule.end.y = floorY + 1.38;
    this.camera.position.set(this.capsule.end.x, this.capsule.end.y + 0.12, this.capsule.end.z);
    this._applyEuler();
  }

  _applyEuler() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }

  setVirtualKey(code, pressed) {
    this.keys[code] = pressed;
  }

  getLookDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(this.camera.rotation);
    return dir;
  }

  update(dt) {
    if (this.mode === 'dollhouse') return;

    if (this.tween) {
      const elapsed = performance.now() - this.tween.startTime;
      const t = Math.min(1, elapsed / this.tween.duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, ease);
      this.yaw = THREE.MathUtils.lerp(this.tween.startYaw, this.tween.endYaw, ease);
      this.pitch = THREE.MathUtils.lerp(this.tween.startPitch, this.tween.endPitch, ease);
      const nextFov = THREE.MathUtils.lerp(this.tween.startFov, this.tween.endFov, ease);
      if (Math.abs(nextFov - this.camera.fov) > 0.01) {
        this.camera.fov = nextFov;
        this.camera.updateProjectionMatrix();
      }
      this._applyEuler();
      if (t >= 1) {
        this.syncCapsuleFromCamera();
        this.tween = null;
      }
      return;
    }

    const forwardInput =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const strafeInput =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);

    // Allow WASD walking anytime (both walk mode AND tour mode seamlessly!)
    if (this.mode === 'walk' || forwardInput !== 0 || strafeInput !== 0) {
      if (forwardInput !== 0 || strafeInput !== 0) {
        this.onUserInteract?.();
      }
      const speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 4.2 : 2.35;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, forwardInput)
        .addScaledVector(right, strafeInput);
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize().multiplyScalar(speed);
      }

      const damping = Math.exp(-12 * dt);
      this.velocity.x = THREE.MathUtils.lerp(moveDir.x, this.velocity.x, damping);
      this.velocity.z = THREE.MathUtils.lerp(moveDir.z, this.velocity.z, damping);
      if (!this.isGrounded) {
        this.velocity.y -= 18 * dt;
      }

      const subSteps = 4;
      const stepDt = dt / subSteps;
      for (let i = 0; i < subSteps; i++) {
        this.capsule.translate(this.velocity.clone().multiplyScalar(stepDt));
        const res = this.octree.capsuleIntersect(this.capsule);
        this.isGrounded = false;
        if (res) {
          this.isGrounded = res.normal.y > 0.5;
          if (!this.isGrounded && res.normal.y > 0.05) {
            this.isGrounded = true;
          }
          if (this.velocity.dot(res.normal) < 0) {
            this.velocity.addScaledVector(res.normal, -res.normal.dot(this.velocity));
          }
          this.capsule.translate(res.normal.clone().multiplyScalar(res.depth));
        }
        // Hard safety floor clamp
        if (this.capsule.start.y < -0.5) {
          this.teleportToXZ(-2.5, 2.5);
          break;
        }
      }
      this.camera.position.set(
        this.capsule.end.x,
        this.capsule.end.y + 0.12,
        this.capsule.end.z
      );
    }

    this._applyEuler();
  }
}
