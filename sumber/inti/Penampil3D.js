import * as THREE from 'three';
import { GLTFLoader } from '../../pustaka/GLTFLoader.js';
import { mergeGeometries } from '../../pustaka/BufferGeometryUtils.js';

const FOLAGE_SKIP_KEYS = [
  'c-layer',
  'composant#4',
  'composant#6',
  'composant#10',
  'composant#11',
  'composant#8',
  'composant#9',
  'obj3d66',
  'rectangle014',
  'circle058',
  'jiangjiang0007',
  'jiangjiang0008',
  'land_tree_',
  'land_front_shrub_',
];

const ROOF_NAME_PREFIXES = [
  'Arch_Roof_',
  'Arch_Ceiling_',
  'Arch_Teras_Canopy',
  'Arch_Carport_',
  'Arch_Courtyard_Frame_',
  'Arch_Courtyard_PergolaBeam_',
  'DL_',
  'Furn_Living_Lamp_',
];

function createSketchUpSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#8ec0eb');
  grad.addColorStop(0.32, '#bcd9f2');
  grad.addColorStop(0.495, '#eef5fb');
  grad.addColorStop(0.505, '#d4dce1');
  grad.addColorStop(0.75, '#c1c9cf');
  grad.addColorStop(1.00, '#b2bbc1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function createRealisticSkyDome(sunDir) {
  const geo = new THREE.SphereGeometry(115, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uZenith: { value: new THREE.Color('#4f92d6') },
      uHorizon: { value: new THREE.Color('#e6f1fa') },
      uGround: { value: new THREE.Color('#a4b4a5') },
      uSunColor: { value: new THREE.Color('#fff8e6') },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform vec3 uSunColor;
      varying vec3 vWorldDir;
      void main() {
        vec3 d = normalize(vWorldDir);
        float h = d.y;
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.52));
        vec3 col = h >= 0.0 ? sky : mix(uHorizon, uGround, clamp(-h * 4.5, 0.0, 1.0));
        float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sunDot, 220.0) * 1.5;
        col += uSunColor * pow(sunDot, 9.0) * 0.22;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(-3.0, 0.0, -7.0);
  mesh.raycast = () => {};
  return mesh;
}

function createContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0.0, 'rgba(18, 22, 28, 0.55)');
  g.addColorStop(0.55, 'rgba(18, 22, 28, 0.26)');
  g.addColorStop(1.0, 'rgba(18, 22, 28, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function normalizeGeometryForMerge(srcGeo, worldMatrix) {
  let g = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  g.applyMatrix4(worldMatrix);
  for (const attr of Object.keys(g.attributes)) {
    if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
      g.deleteAttribute(attr);
    }
  }
  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  const posCount = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posCount * 2), 2));
  }
  g.morphAttributes = {};
  return g;
}

export class Viewer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.sketchupBg = createSketchUpSkyTexture();
    this.clayBg = new THREE.Color('#eef2f6');
    this.realFog = new THREE.FogExp2('#dfebf4', 0.0068);

    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.08, 220);
    this.camera.position.set(-2.5, 1.65, 2.5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.20;
    container.appendChild(this.renderer.domElement);

    this.meshes = [];
    this.roofObjects = [];
    this.edgeLines = [];
    this.contactShadows = new THREE.Group();
    this.originalMaterials = new Map();

    this.edgesEnabled = false;
    this.currentStyle = 'realita';
    this.sunHour = 10.5;
    this.maketCutaway = false;
    this.dirty = true;

    this.clayMat = new THREE.MeshStandardMaterial({
      color: 0xf4f5f7,
      roughness: 0.86,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.clayGlassMat = new THREE.MeshStandardMaterial({
      color: 0xb9dcf2,
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    this.sunDir = new THREE.Vector3(-0.35, 0.88, 0.32).normalize();
    this.skyDome = createRealisticSkyDome(this.sunDir);
    this.scene.add(this.skyDome);

    this._setupEnvironmentIBL();
    this._setupLighting();
    this._setupContactShadows();
    this.setStyle('realita');

    window.addEventListener('resize', () => this.onResize());
  }

  _setupEnvironmentIBL() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = this.sketchupBg;

    // Bright daylight studio bounce & window softboxes so Cycles-style reflections shine on ceramics, marble & wood
    const floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({ color: 0xf1e8db, side: THREE.DoubleSide })
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.y = -3;
    envScene.add(floorBounce);

    const ceilSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    ceilSoftbox.rotation.x = Math.PI / 2;
    ceilSoftbox.position.y = 14;
    envScene.add(ceilSoftbox);

    const windowCardL = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 8),
      new THREE.MeshBasicMaterial({ color: 0xf4f9ff, side: THREE.DoubleSide })
    );
    windowCardL.position.set(-14, 4, -5);
    windowCardL.rotation.y = Math.PI / 2;
    envScene.add(windowCardL);

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff6e2 })
    );
    sunOrb.position.set(-8, 18, 8);
    envScene.add(sunOrb);

    this.envTarget = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 1.02;
    pmrem.dispose();
  }

  _setupLighting() {
    // High-key Cycles-style global illumination sky + warm floor bounce
    this.hemiLight = new THREE.HemisphereLight(0xfafcff, 0xeee4d6, 1.32);
    this.hemiLight.position.set(-3, 20, -7);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xfffdf8, 0.24);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8ec, 2.45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 55;
    const d = 13.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00028;
    this.sunLight.shadow.normalBias = 0.018;
    this.sunLight.target.position.set(-3.0, 0.5, -7.5);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Living + Dining Indirect GI Fill
    this.fillLiving = new THREE.PointLight(0xfff1de, 1.75, 15, 1.05);
    this.fillLiving.position.set(-1.55, 2.72, -8.8);
    this.scene.add(this.fillLiving);

    // Kitchen Under-Cabinet Warm LED + Island Pendant Glow (illuminates glossy green backsplash & stone)
    this.fillKitchenGlow = new THREE.PointLight(0xffddb0, 2.15, 6.2, 1.3);
    this.fillKitchenGlow.position.set(-1.35, 1.85, -13.15);
    this.scene.add(this.fillKitchenGlow);

    // Courtyard Open-Air Skylight Horizontal GI Bounce pouring into Kitchen
    this.fillCourtyard = new THREE.PointLight(0xf0f7ff, 1.85, 8.5, 1.1);
    this.fillCourtyard.position.set(-3.85, 2.35, -12.9);
    this.scene.add(this.fillCourtyard);

    // MasterBed / Bath / Bed2 Warm Architectural Fill
    this.fillPrivate = new THREE.PointLight(0xfff0dc, 1.55, 12, 1.1);
    this.fillPrivate.position.set(-4.45, 2.72, -8.5);
    this.scene.add(this.fillPrivate);

    this.setSunHour(this.sunHour);
  }

  _setupContactShadows() {
    const tex = createContactShadowTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const cards = [
      // Living Sofa, Coffee Table, Lamp, TV console shadow
      [-0.45, 0.1512, -7.36, 1.05, 2.10],
      [-1.42, 0.1512, -7.36, 0.62, 1.08],
      [-0.26, 0.1512, -8.65, 0.44, 0.44],
      [-2.78, 0.1512, -7.06, 0.50, 1.66],
      // Kitchen Island & Stools
      [-1.80, 0.1512, -11.86, 1.18, 2.00],
      // Master Bed, Nightstand, Wardrobe
      [-4.89, 0.1515, -6.15, 1.48, 1.98],
      [-5.78, 0.1515, -5.42, 0.48, 0.48],
      [-3.35, 0.1515, -6.00, 0.52, 1.62],
      // Bathroom WC & Vanity
      [-5.64, 0.1515, -8.95, 0.72, 0.50],
      [-4.62, 0.1515, -8.07, 0.76, 0.48],
      // Bedroom 2 Bed, Desk & Chair
      [-5.50, 0.1515, -10.89, 1.12, 2.08],
      [-3.42, 0.1515, -11.12, 0.68, 1.42],
      [-3.86, 0.1515, -11.12, 0.60, 0.60],
    ];
    for (const [cx, cy, cz, sx, sz] of cards) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, cy, cz);
      m.raycast = () => {};
      this.contactShadows.add(m);
    }
    this.scene.add(this.contactShadows);
  }

  async loadAssets(onProgress) {
    const loader = new GLTFLoader();
    const loadGLB = (url, weightStart, weightSpan) =>
      new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            onProgress?.(weightStart + weightSpan);
            resolve(gltf);
          },
          (ev) => {
            if (ev.total > 0) {
              const frac = Math.min(1, ev.loaded / ev.total);
              onProgress?.(weightStart + frac * weightSpan);
            }
          },
          reject
        );
      });

    const [collGltf, visGltf] = await Promise.all([
      loadGLB('./aset/kolider_rumah.glb', 0, 12),
      loadGLB('./aset/model_rumah.glb', 12, 85),
    ]);

    const rawRoot = visGltf.scene;
    rawRoot.updateMatrixWorld(true);

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() || 4);
    const inkMat = new THREE.LineBasicMaterial({
      color: 0x1a2029,
      transparent: true,
      opacity: 0.58,
    });
    this.edgeMat = inkMat;

    const bodyEdgeGeos = [];
    const roofEdgeGeos = [];
    const opaqueBatches = new Map();
    const glassBatches = new Map();
    const specialGroup = new THREE.Group();
    specialGroup.name = 'House_DynamicAndRoof';

    rawRoot.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const lower = (child.name || '').toLowerCase();

      // Hide any residual SketchUp V-Ray rectangular light plane helpers so they never appear as flat white cards
      if (lower.includes('v-ray rectangle light')) return;

      const mat = child.material;
      const matName = mat?.name?.toLowerCase() || '';
      if (mat && mat.transmission > 0) {
        // Avoid expensive per-frame full-scene transmission offscreen passes while keeping crisp glass look
        mat.transmission = 0;
        mat.transparent = true;
        mat.opacity = 0.32;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
      const isGlass =
        mat?.transparent ||
        matName.includes('glass') ||
        matName.includes('translucent');

      if (mat) {
        for (const mapKey of ['map', 'normalMap', 'roughnessMap']) {
          if (mat[mapKey]) {
            mat[mapKey].anisotropy = maxAniso;
            mat[mapKey].needsUpdate = true;
          }
        }
        if (mat.roughness !== undefined && (mat.roughness <= 0.35 || mat.metalness > 0.2 || isGlass)) {
          mat.envMapIntensity = 1.35;
        }
        if (!isGlass) {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = 1;
          mat.polygonOffsetUnits = 1;
        }
      }

      const isRoof = ROOF_NAME_PREFIXES.some((p) => child.name.startsWith(p));

      const vertCount = child.geometry?.attributes?.position?.count || 0;
      const skipEdges =
        isGlass ||
        vertCount > 7500 ||
        FOLAGE_SKIP_KEYS.some((k) => lower.includes(k));

      if (!skipEdges) {
        const edgesGeo = new THREE.EdgesGeometry(child.geometry, 35);
        if (edgesGeo.attributes.position && edgesGeo.attributes.position.count > 0) {
          edgesGeo.applyMatrix4(child.matrixWorld);
          if (isRoof) roofEdgeGeos.push(edgesGeo);
          else bodyEdgeGeos.push(edgesGeo);
        } else {
          edgesGeo.dispose();
        }
      }

      if (isRoof) {
        const worldGeo = normalizeGeometryForMerge(child.geometry, child.matrixWorld);
        const keepMesh = new THREE.Mesh(worldGeo, mat);
        keepMesh.name = child.name;
        keepMesh.castShadow = !isGlass;
        keepMesh.receiveShadow = true;
        specialGroup.add(keepMesh);
        this.meshes.push(keepMesh);
        this.originalMaterials.set(keepMesh, mat);
        this.roofObjects.push(keepMesh);
        child.geometry.dispose();
      } else if (isGlass) {
        if (!glassBatches.has(mat)) {
          glassBatches.set(mat, { mat, geos: [] });
        }
        glassBatches.get(mat).geos.push(normalizeGeometryForMerge(child.geometry, child.matrixWorld));
        child.geometry.dispose();
      } else {
        if (!opaqueBatches.has(mat)) {
          opaqueBatches.set(mat, { mat, geos: [] });
        }
        opaqueBatches.get(mat).geos.push(normalizeGeometryForMerge(child.geometry, child.matrixWorld));
        child.geometry.dispose();
      }
    });

    this.modelRoot = new THREE.Group();
    this.modelRoot.name = 'House_MergedBatches';
    for (const { mat, geos } of opaqueBatches.values()) {
      if (geos.length === 0) continue;
      const mergedGeo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      if (!mergedGeo) continue;
      const batchMesh = new THREE.Mesh(mergedGeo, mat);
      batchMesh.name = `Batch_${mat?.name || 'Mat'}`;
      batchMesh.castShadow = true;
      batchMesh.receiveShadow = true;
      this.modelRoot.add(batchMesh);
      this.meshes.push(batchMesh);
      this.originalMaterials.set(batchMesh, mat);
    }
    for (const { mat, geos } of glassBatches.values()) {
      if (geos.length === 0) continue;
      const mergedGeo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      if (!mergedGeo) continue;
      const glassMesh = new THREE.Mesh(mergedGeo, mat);
      glassMesh.name = `GlassBatch_${mat?.name || 'Mat'}`;
      glassMesh.castShadow = false;
      glassMesh.receiveShadow = true;
      specialGroup.add(glassMesh);
      this.meshes.push(glassMesh);
      this.originalMaterials.set(glassMesh, mat);
    }
    this.modelRoot.add(specialGroup);
    this.scene.add(this.modelRoot);

    if (bodyEdgeGeos.length > 0) {
      const mergedBody = mergeGeometries(bodyEdgeGeos, false);
      bodyEdgeGeos.forEach((g) => g.dispose());
      this.bodyEdgeLine = new THREE.LineSegments(mergedBody, inkMat);
      this.bodyEdgeLine.name = 'SKP_Edges_Body';
      this.bodyEdgeLine.raycast = () => {};
      this.scene.add(this.bodyEdgeLine);
      this.edgeLines.push(this.bodyEdgeLine);
    }

    if (roofEdgeGeos.length > 0) {
      const mergedRoof = mergeGeometries(roofEdgeGeos, false);
      roofEdgeGeos.forEach((g) => g.dispose());
      this.roofEdgeLine = new THREE.LineSegments(mergedRoof, inkMat);
      this.roofEdgeLine.name = 'SKP_Edges_Roof';
      this.roofEdgeLine.raycast = () => {};
      this.scene.add(this.roofEdgeLine);
      this.edgeLines.push(this.roofEdgeLine);
    }

    this.setStyle(this.currentStyle);
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
    onProgress?.(100);
    return collGltf.scene;
  }

  setStyle(styleName) {
    this.currentStyle = styleName;
    this.dirty = true;

    if (styleName === 'monokrom') {
      this.skyDome.visible = false;
      this.contactShadows.visible = false;
      this.scene.background = this.clayBg;
      this.scene.fog = null;
      this.scene.environmentIntensity = 0.28;
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.hemiLight.intensity = 1.15;
      this.sunLight.intensity = 1.35;
      if (this.edgeMat) {
        this.edgeMat.opacity = 0.84;
        this.edgeMat.color.setHex(0x111827);
      }
      this.setEdgesVisible(true);
      for (const m of this.meshes) {
        const orig = this.originalMaterials.get(m);
        const isGlass = orig?.transparent || (orig?.name || '').toLowerCase().includes('glass');
        m.material = isGlass ? this.clayGlassMat : this.clayMat;
      }
    } else if (styleName === 'sketchup') {
      this.skyDome.visible = false;
      this.contactShadows.visible = true;
      this.scene.background = this.sketchupBg;
      this.scene.fog = null;
      this.scene.environmentIntensity = 0.45;
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.hemiLight.intensity = 1.12;
      this.sunLight.intensity = 1.75;
      if (this.edgeMat) {
        this.edgeMat.opacity = 0.60;
        this.edgeMat.color.setHex(0x1a2029);
      }
      this.setEdgesVisible(true);
      for (const m of this.meshes) {
        m.material = this.originalMaterials.get(m);
      }
    } else {
      // 'realita' (Default): High-Key Sunlit Cycles/Enscape GI Feel + Specular Reflections + Grounded Contact AO
      this.skyDome.visible = true;
      this.contactShadows.visible = true;
      this.scene.background = null;
      this.scene.fog = this.realFog;
      this.scene.environmentIntensity = 1.02;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.20;
      this.hemiLight.intensity = 1.32;
      this.sunLight.intensity = 2.45;
      if (this.edgeMat) {
        this.edgeMat.opacity = 0.20;
        this.edgeMat.color.setHex(0x28323e);
      }
      this.setEdgesVisible(false);
      for (const m of this.meshes) {
        m.material = this.originalMaterials.get(m);
      }
    }
  }

  setEdgesVisible(visible) {
    this.edgesEnabled = visible;
    if (this.bodyEdgeLine) this.bodyEdgeLine.visible = visible;
    if (this.roofEdgeLine) this.roofEdgeLine.visible = visible && !this.maketCutaway;
    this.dirty = true;
  }

  setMaketCutaway(cutaway) {
    this.maketCutaway = cutaway;
    for (const obj of this.roofObjects) {
      obj.visible = !cutaway;
    }
    if (this.roofEdgeLine) {
      this.roofEdgeLine.visible = !cutaway && this.edgesEnabled;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  setSunHour(hour) {
    this.sunHour = hour;
    const t = Math.max(0, Math.min(1, (hour - 6.5) / 11.0));
    const elevDeg = 24 + Math.sin(t * Math.PI) * 52;
    const azimDeg = -65 + t * 130;
    const phi = THREE.MathUtils.degToRad(90 - elevDeg);
    const theta = THREE.MathUtils.degToRad(azimDeg);
    const dist = 26;

    const dx = Math.sin(phi) * Math.sin(theta);
    const dy = Math.cos(phi);
    const dz = Math.sin(phi) * Math.cos(theta);
    this.sunDir.set(dx, dy, dz).normalize();

    this.sunLight.position.set(-3.0 + dx * dist, dy * dist, -7.5 + dz * dist);
    if (this.skyDome?.material?.uniforms?.uSunDir) {
      this.skyDome.material.uniforms.uSunDir.value.copy(this.sunDir);
    }

    const warmth = 1.0 - Math.sin(t * Math.PI) * 0.55;
    this.sunLight.color.setRGB(1.0, 0.98 - warmth * 0.06, 0.94 - warmth * 0.14);
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  onResize() {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.dirty = true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
