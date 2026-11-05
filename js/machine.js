// Three.js 场景：3D 扭蛋机建模、动画、镜头
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PALETTE = [0x00e5ff, 0xff3ea5, 0xffd166, 0x9b5cff, 0xff7a45, 0xf5f7ff];

const GLOBE_CENTER = new THREE.Vector3(0, 2.85, 0);
const GLOBE_R = 1.15;
const TRAY_POS = new THREE.Vector3(0, 0.62, 1.78);
const EGG_SCALE = 1.2;
const MAX_VISIBLE_CAPSULES = 20;

function makeSignTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  // 主标题霓虹：自动缩放到安全宽度内，防止两侧裁剪
  const title = '1024 解愿扭蛋局';
  let size = 118;
  const setFont = () => {
    g.font = `bold ${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
  };
  setFont();
  while (g.measureText(title).width > 930 && size > 40) {
    size -= 4;
    setFont();
  }
  g.shadowColor = '#00e5ff';
  g.shadowBlur = 34;
  g.fillStyle = '#bffbff';
  g.fillText(title, 512, 150);
  g.shadowBlur = 18;
  g.fillText(title, 512, 150);
  // 副标题
  g.shadowColor = '#ff3ea5';
  g.shadowBlur = 16;
  g.fillStyle = '#ffd9ec';
  g.font = '38px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  g.fillText('同学的问题，扭个办法', 512, 235);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(140,235,255,0.55)');
  grad.addColorStop(1, 'rgba(0,229,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 扭蛋：两半球 + 接缝圈（上彩下白，球仓里颜色更跳）
function makeCapsule(color) {
  const group = new THREE.Group();
  const r = 0.16;
  const topMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.25, metalness: 0.05,
  });
  const botMat = new THREE.MeshStandardMaterial({
    color: 0xf2f4ff, roughness: 0.25, metalness: 0.05,
  });
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), topMat);
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), botMat);
  const seam = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.014, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x22263a, roughness: 0.5 }));
  seam.rotation.x = Math.PI / 2;
  group.add(top, bottom, seam);
  group.userData.halves = { top, bottom };
  return group;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class GashaponMachine {
  constructor(container) {
    this.container = container;
    this.tweens = [];
    this.capsules = [];
    this.shaking = false;
    this.pointer = new THREE.Vector2(0, 0);

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05010f);
    this.scene.fog = new THREE.Fog(0x05010f, 10, 26);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

    // 相机
    this.camera = new THREE.PerspectiveCamera(
      42, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camBase = new THREE.Vector3(3.5, 3.05, 5.2);
    this.camTarget = new THREE.Vector3(0, 2.0, 0);
    this.camFocus = new THREE.Vector3();
    this.camera.position.copy(this.camBase);
    this.camFocus.copy(this.camTarget);

    // 灯光
    this.scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a0b2e, 0.55));
    const key = new THREE.PointLight(0x00e5ff, 60, 30);
    key.position.set(-4, 5, 4);
    this.scene.add(key);
    const rim = new THREE.PointLight(0xff3ea5, 55, 30);
    rim.position.set(4.5, 3.5, -3.5);
    this.scene.add(rim);
    const warm = new THREE.SpotLight(0xffd166, 90, 25, Math.PI / 5, 0.5);
    warm.position.set(0, 7, 6);
    warm.target.position.set(0, 1.5, 0);
    this.scene.add(warm, warm.target);

    this._buildStage();
    this._buildMachine();
    this._buildStars();

    window.addEventListener('resize', () => this._resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    this.clock = new THREE.Clock();
    this._animate();
  }

  // 地面 + 霓虹光环
  _buildStage() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ color: 0x0b0620, roughness: 0.85, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ring1 = new THREE.Mesh(
      new THREE.RingGeometry(2.35, 2.5, 96),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.012;
    this.scene.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(3.3, 3.36, 96),
      new THREE.MeshBasicMaterial({ color: 0xff3ea5, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }));
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.01;
    this.scene.add(ring2);
    this.rings = [ring1, ring2];
  }

  _buildMachine() {
    const M = this.machine = new THREE.Group();
    this.scene.add(M);

    // 底座机身
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1b2350, roughness: 0.35, metalness: 0.55,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.5, 48), bodyMat);
    body.position.y = 0.75;
    M.add(body);

    // 底座底部霓虹描边
    const baseTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.03, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    baseTrim.rotation.x = Math.PI / 2;
    baseTrim.position.y = 0.06;
    M.add(baseTrim);

    // 机身霓虹灯牌
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.56),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(), transparent: true }));
    sign.position.set(0, 1.22, 1.27);
    M.add(sign);

    // 颈部
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.22, 40), bodyMat);
    neck.position.y = 1.61;
    M.add(neck);

    // 玻璃球仓
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R, 48, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.04, metalness: 0,
        transmission: 0.92, thickness: 0.25, ior: 1.45,
        clearcoat: 1, clearcoatRoughness: 0.06,
        envMapIntensity: 2.2, specularIntensity: 1,
      }));
    globe.position.copy(GLOBE_CENTER);
    M.add(globe);

    // 球口环
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.05, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a3570, roughness: 0.3, metalness: 0.7 }));
    mouth.rotation.x = Math.PI / 2;
    mouth.position.y = 1.72;
    M.add(mouth);

    // 出蛋口（底部正面）
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x141a3d, roughness: 0.4, metalness: 0.5 });
    const chute = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.46, 0.52), chuteMat);
    chute.position.set(0, 0.72, 1.27);
    M.add(chute);
    const chuteHole = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.34, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x03040c }));
    chuteHole.position.set(0, 0.7, 1.535);
    M.add(chuteHole);
    // 洞口下沿的斜舌（蛋滚出的过渡面）
    const tongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.04, 0.3),
      chuteMat);
    tongue.position.set(0, 0.53, 1.66);
    tongue.rotation.x = 0.18;
    M.add(tongue);

    // 托盘
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.62), chuteMat);
    tray.position.set(TRAY_POS.x, TRAY_POS.y - 0.16, TRAY_POS.z);
    M.add(tray);
    const trayGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.58),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 }));
    trayGlow.rotation.x = -Math.PI / 2;
    trayGlow.position.set(TRAY_POS.x, TRAY_POS.y - 0.13, TRAY_POS.z);
    M.add(trayGlow);

    // 摇杆
    const crank = this.crank = new THREE.Group();
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0xc8d2ff, roughness: 0.3, metalness: 0.8 }));
    axle.rotation.z = Math.PI / 2;
    axle.position.x = 0.2;
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.42, 16),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.35 }));
    arm.position.set(0.4, 0.21, 0);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xff3ea5, roughness: 0.25 }));
    knob.position.set(0.4, 0.44, 0);
    crank.add(axle, arm, knob);
    crank.position.set(1.18, 1.0, 0);
    M.add(crank);

    // 球仓内扭蛋：按重力堆积在球体底部（层叠环）
    const homes = this._pileHomes(MAX_VISIBLE_CAPSULES);
    for (let i = 0; i < MAX_VISIBLE_CAPSULES; i++) {
      const cap = makeCapsule(PALETTE[i % PALETTE.length]);
      cap.userData.home = homes[i];
      cap.position.copy(homes[i]);
      cap.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      M.add(cap);
      this.capsules.push(cap);
    }

    // 出蛋口的蛋（隐藏待用）
    this.egg = makeCapsule(0xffd166);
    this.egg.position.copy(TRAY_POS);
    this.egg.visible = false;
    this.egg.scale.setScalar(EGG_SCALE);
    M.add(this.egg);
    this.eggDefaultMats = {
      top: this.egg.userData.halves.top.material,
      bottom: this.egg.userData.halves.bottom.material,
    };

    // 开蛋光效
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.glow.position.copy(TRAY_POS);
    this.glow.scale.setScalar(0.01);
    M.add(this.glow);
  }

  _buildStars() {
    const n = 450;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 18 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.9 + 0.5;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xaad4ff, size: 0.07, transparent: true, opacity: 0.75, sizeAttenuation: true,
    }));
    this.scene.add(this.stars);
  }

  // 底部堆积位：球形罩内层叠环，模拟重力自然堆出的蛋堆
  _pileHomes(n) {
    const layers = [
      { dy: -0.62, r: 0.56, count: 8 },
      { dy: -0.4, r: 0.4, count: 6 },
      { dy: -0.17, r: 0.22, count: 4 },
      { dy: 0.04, r: 0.0, count: 2 },
    ];
    const homes = [];
    for (const L of layers) {
      for (let i = 0; i < L.count; i++) {
        const a = (i / L.count) * Math.PI * 2 + L.dy * 5;
        homes.push(new THREE.Vector3(
          Math.cos(a) * L.r + (Math.random() - 0.5) * 0.07,
          GLOBE_CENTER.y + L.dy + (Math.random() - 0.5) * 0.05,
          Math.sin(a) * L.r + (Math.random() - 0.5) * 0.07));
      }
    }
    // 随机打散顺序后取前 n 个
    for (let i = homes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [homes[i], homes[j]] = [homes[j], homes[i]];
    }
    return homes.slice(0, n);
  }

  // ---------- 动画原语 ----------
  _addTween(tw) {
    tw.t = 0;
    this.tweens.push(tw);
    return new Promise((resolve) => { tw.resolve = resolve; });
  }

  _updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt / tw.dur;
      const k = Math.min(tw.t, 1);
      tw.update((tw.ease || easeInOut)(k), k);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        if (tw.resolve) tw.resolve();
      }
    }
  }

  // 摇动阶段：机身摆动 + 摇杆旋转 + 蛋翻滚
  async shake() {
    if (this.shaking) return;
    this.shaking = true;
    const M = this.machine;
    const shakeTween = this._addTween({
      dur: 1.7,
      ease: (t) => t,
      update: (k) => {
        const decay = 1 - k * 0.55;
        M.rotation.z = Math.sin(k * Math.PI * 14) * 0.05 * decay;
        M.position.y = Math.abs(Math.sin(k * Math.PI * 7)) * 0.03 * decay;
        this.crank.rotation.x += 0.35 * decay;
        for (const cap of this.capsules) {
          // 围绕堆积位剧烈抖动（非累积，不会漂移出球仓）
          const home = cap.userData.home;
          const j = 0.1 * decay;
          cap.position.set(
            home.x + (Math.random() - 0.5) * 2 * j,
            home.y + Math.abs(Math.random() - 0.5) * 2 * j * 1.8,
            home.z + (Math.random() - 0.5) * 2 * j);
          cap.rotation.y += 0.18 * decay;
          cap.rotation.x += 0.1 * decay;
        }
      },
    });
    await shakeTween;
    // 回正
    M.rotation.z = 0;
    M.position.y = 0;
    this.shaking = false;
  }

  // 金色扭蛋（已解案例）
  setEggGolden(golden) {
    const { top, bottom } = this.egg.userData.halves;
    if (golden) {
      if (!this._goldMats) {
        this._goldMats = {
          top: new THREE.MeshStandardMaterial({
            color: 0xffe9ad, roughness: 0.18, metalness: 0.55,
            emissive: 0x7a5200, emissiveIntensity: 0.35,
          }),
          bottom: new THREE.MeshStandardMaterial({
            color: 0xffc93e, roughness: 0.2, metalness: 0.55,
            emissive: 0x8a5a00, emissiveIntensity: 0.4,
          }),
        };
      }
      top.material = this._goldMats.top;
      bottom.material = this._goldMats.bottom;
      this.glow.material.color.set(0xffd166);
    } else {
      top.material = this.eggDefaultMats.top;
      bottom.material = this.eggDefaultMats.bottom;
      this.glow.material.color.set(0xffffff);
    }
  }

  // 掉蛋阶段：一颗蛋从洞口滚出到托盘，镜头推近
  // remaining（剩余扭蛋数）>= 可见蛋数时，球仓保持满员，不少蛋
  async dropEgg(golden = false, remaining = 0) {
    this.setEggGolden(golden);
    if (remaining < MAX_VISIBLE_CAPSULES && this.capsules.length > 0) {
      const idx = Math.floor(Math.random() * this.capsules.length);
      const cap = this.capsules.splice(idx, 1)[0];
      cap.visible = false;
    }
    // 蛋先在洞口内侧（被机身遮住），随后滚出洞口、沿斜舌落上托盘——
    // 符合真实扭蛋机"转盘对位后蛋受重力滑落"的原理
    this.egg.visible = true;
    this.egg.scale.setScalar(EGG_SCALE);
    this.egg.position.set(0, 0.62, 1.3);
    const start = this.egg.position.clone();
    const end = TRAY_POS.clone();
    const camFrom = this.camera.position.clone();
    const focusFrom = this.camFocus.clone();
    const camTo = new THREE.Vector3(1.55, 1.6, 3.6);
    const focusTo = end.clone();

    const dropPromise = this._addTween({
      dur: 0.95,
      ease: (t) => t,
      update: (k, raw) => {
        const kk = easeOutCubic(raw);
        const p = start.clone().lerp(end, kk);
        // 滚落托盘瞬间的小弹跳
        if (raw > 0.82) {
          const b = (raw - 0.82) / 0.18;
          p.y += Math.abs(Math.sin(b * Math.PI)) * 0.09 * (1 - b);
        }
        this.egg.position.copy(p);
        this.egg.rotation.x += 0.14;
      },
    });
    const camPromise = this._addTween({
      dur: 0.9,
      update: (k) => {
        this.camera.position.lerpVectors(camFrom, camTo, k);
        this.camFocus.lerpVectors(focusFrom, focusTo, k);
        this.camera.lookAt(this.camFocus);
      },
    });
    await Promise.all([dropPromise, camPromise]);
  }

  // 开蛋阶段：两半弹开 + 光效
  async openEgg() {
    const { top, bottom } = this.egg.userData.halves;
    const topY = top.position.y, botY = bottom.position.y;
    const glowScale = this.glow.scale.x;

    const openPromise = this._addTween({
      dur: 0.55,
      update: (k) => {
        top.position.y = topY + k * 0.55;
        top.rotation.z = k * 0.7;
        bottom.position.y = botY - k * 0.28;
        this.glow.material.opacity = Math.sin(k * Math.PI) * 0.95;
        this.glow.scale.setScalar(Math.max(glowScale, k * 1.9));
      },
    });
    await openPromise;
    this.glow.material.opacity = 0;
  }

  // 收卡后复位：镜头回位，蛋收回，球仓补满
  resetForNext() {
    const camFrom = this.camera.position.clone();
    const focusFrom = this.camFocus.clone();
    this._addTween({
      dur: 0.8,
      update: (k) => {
        this.camera.position.lerpVectors(camFrom, this.camBase, k);
        this.camFocus.lerpVectors(focusFrom, this.camTarget, k);
        this.camera.lookAt(this.camFocus);
      },
    });
    // 收蛋
    this._addTween({
      dur: 0.4,
      update: (k) => {
        this.egg.scale.setScalar(EGG_SCALE * (1 - k) + 0.01);
      },
    }).then(() => {
      this.egg.visible = false;
      this.egg.scale.setScalar(EGG_SCALE);
      const { top, bottom } = this.egg.userData.halves;
      top.position.set(0, 0, 0);
      top.rotation.set(0, 0, 0);
      bottom.position.set(0, 0, 0);
      this.setEggGolden(false);
    });
    // 补蛋：把蛋仓重新填满
    if (this.capsules.length < MAX_VISIBLE_CAPSULES) {
      const need = MAX_VISIBLE_CAPSULES - this.capsules.length;
      const homes = this._pileHomes(need + this.capsules.length);
      for (let i = 0; i < need; i++) {
        const cap = makeCapsule(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
        cap.userData.home = homes[this.capsules.length + i];
        cap.position.copy(cap.userData.home);
        cap.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        this.machine.add(cap);
        this.capsules.push(cap);
      }
    }
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this._tick(Math.min(this.clock.getDelta(), 0.05));
  }

  // 单帧更新（RAF 驱动）
  _tick(dt) {
    const t = this.clock.elapsedTime;

    this._updateTweens(dt);

    // 蛋堆重力回位：摇动结束后蛋自然落回堆积位
    if (!this.shaking) {
      const k = Math.min(1, dt * 4.5);
      for (const cap of this.capsules) {
        cap.position.lerp(cap.userData.home, k);
      }
    }

    // 待机动画：相机轻微呼吸 + 鼠标视差
    if (!this.shaking && this.tweens.length === 0) {
      const sway = new THREE.Vector3(
        Math.sin(t * 0.4) * 0.12 + this.pointer.x * 0.35,
        Math.sin(t * 0.6) * 0.06 - this.pointer.y * 0.2,
        0);
      this.camera.position.copy(this.camBase).add(sway);
      this.camera.lookAt(this.camFocus);
    }

    // 光环脉动
    if (this.rings) {
      this.rings[0].material.opacity = 0.55 + Math.sin(t * 2.2) * 0.25;
      this.rings[1].material.opacity = 0.32 + Math.sin(t * 1.7 + 1) * 0.14;
    }

    // 星空缓转
    if (this.stars) this.stars.rotation.y += dt * 0.008;

    this.renderer.render(this.scene, this.camera);
  }
}
