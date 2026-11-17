import * as THREE from 'three';
import { OrbitControls } from '../../pustaka/OrbitControls.js';

export class DollhouseControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 32.0;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(-3.0, 1.1, -7.2);
    this.controls.enabled = false;
    this.tween = null;
  }

  activate(eye = [8.5, 13.5, 4.5], target = [-3.0, 1.1, -7.2], fov = 45, durationMs = 700) {
    this.controls.enabled = true;
    const fromPos = this.camera.position.clone();
    const toPos = new THREE.Vector3(...eye);
    const fromTgt = this.controls.target.clone();
    const toTgt = new THREE.Vector3(...target);
    const startFov = this.camera.fov;

    if (durationMs <= 0) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTgt);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      return;
    }

    this.tween = {
      startTime: performance.now(),
      duration: durationMs,
      fromPos,
      toPos,
      fromTgt,
      toTgt,
      startFov,
      endFov: fov,
    };
  }

  deactivate() {
    this.controls.enabled = false;
    this.tween = null;
  }

  update() {
    if (!this.controls.enabled) return;
    if (this.tween) {
      const elapsed = performance.now() - this.tween.startTime;
      const t = Math.min(1, elapsed / this.tween.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, ease);
      this.controls.target.lerpVectors(this.tween.fromTgt, this.tween.toTgt, ease);
      this.camera.fov = THREE.MathUtils.lerp(this.tween.startFov, this.tween.endFov, ease);
      this.camera.updateProjectionMatrix();
      if (t >= 1) this.tween = null;
    }
    this.controls.update();
  }
}
