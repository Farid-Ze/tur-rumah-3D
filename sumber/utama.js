import * as THREE from 'three';
import { Viewer } from './inti/Penampil3D.js';
import { PlayerController } from './kontrol/KontrolPemain.js';
import { DollhouseControls } from './kontrol/KontrolMaket.js';
import { UIController } from './antarmuka/PengontrolUI.js';
import { TOUR_STOPS } from './data_tur.js';

async function init() {
  const container = document.getElementById('viewport');
  const viewer = new Viewer(container);
  const player = new PlayerController(viewer.camera, viewer.renderer.domElement);
  const dollhouse = new DollhouseControls(viewer.camera, viewer.renderer.domElement);
  const ui = new UIController(viewer, player, dollhouse);

  ui.setLoadingProgress(8, 'Memuat model SketchUp & kolider 3D...');

  try {
    const colliderScene = await viewer.loadAssets((pct) => {
      const msg = pct < 95 ? `Memuat aset arsitektur 3D (${Math.round(pct)}%)...` : 'Menyiapkan lintasan tur & garis tepi...';
      ui.setLoadingProgress(pct, msg);
    });

    player.buildCollider(colliderScene);
    ui.goToStop(0, 0);
    ui.setMode('tour');
    ui.setLoadingProgress(100, 'Siap!');

    // Debug/diagnostics hook for automated checks
    window.__TOUR_STATE__ = {
      viewer,
      player,
      dollhouse,
      ui,
      stops: TOUR_STOPS,
      getStats: () => ({
        meshes: viewer.meshes.length,
        roofObjects: viewer.roofObjects.length,
        edgeLines: viewer.edgeLines.length,
        mode: ui.currentMode,
        style: viewer.currentStyle,
        stopIdx: ui.currentStopIdx,
        maketCutaway: viewer.maketCutaway,
        autoTour: ui.autoTourActive,
        camPos: viewer.camera.position.toArray().map((n) => Number(n.toFixed(3))),
        fov: viewer.camera.fov,
      }),
    };

    const clock = new THREE.Clock();
    const prevCamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
    const prevCamQuat = new THREE.Quaternion();
    let prevFov = -1;

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.08);
      if (ui.currentMode === 'dollhouse') {
        dollhouse.update();
      } else {
        player.update(dt);
      }
      ui.update();

      const cam = viewer.camera;
      const moved =
        cam.position.distanceToSquared(prevCamPos) > 1e-8 ||
        1 - Math.abs(cam.quaternion.dot(prevCamQuat)) > 1e-8 ||
        Math.abs(cam.fov - prevFov) > 1e-4;

      if (viewer.dirty || moved) {
        prevCamPos.copy(cam.position);
        prevCamQuat.copy(cam.quaternion);
        prevFov = cam.fov;
        viewer.dirty = false;
        viewer.render();
      }
    }
    animate();
  } catch (err) {
    console.error('Failed to initialize 3D Tour:', err);
    ui.setLoadingProgress(100, 'Gagal memuat aset 3D.');
    const badge = document.getElementById('room-badge');
    if (badge) badge.textContent = `Error: ${err.message}`;
  }
}

init();
