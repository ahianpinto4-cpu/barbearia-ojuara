import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Máquina de cortar cabelo modelada 100% com geometria do Three.js
 * (sem modelos externos, sem imagens). Altura total ≈ 2,6 unidades;
 * a origem fica na base, para o impacto acontecer no chão (y = 0).
 */
export const CLIPPER_HEIGHT = 2.62;

const GOLD = new THREE.Color("#c9a44c");
const EMBER = new THREE.Color("#df340c");

function brandLabelTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#c9a44c";
  g.font = "600 64px Georgia, 'Times New Roman', serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  // espaçamento entre letras manual (compatível com todos os navegadores)
  const text = "OJUARA";
  const spacing = 18;
  const widths = [...text].map((ch) => g.measureText(ch).width);
  let x = c.width / 2 - (widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1)) / 2;
  [...text].forEach((ch, i) => {
    g.fillText(ch, x + widths[i] / 2, c.height / 2 + 4);
    x += widths[i] + spacing;
  });
  g.fillRect(140, 108, 232, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildClipper(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  /* ------------------------------ Materiais ------------------------------ */
  const bodyMat = track(
    new THREE.MeshPhysicalMaterial({
      color: "#0d0d0d",
      metalness: 0.35,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    }),
  );
  const gripMat = track(new THREE.MeshStandardMaterial({ color: "#141414", metalness: 0.1, roughness: 0.85 }));
  const goldMat = track(new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.24 }));
  const steelMat = track(new THREE.MeshStandardMaterial({ color: "#d9d9d9", metalness: 1, roughness: 0.16 }));
  const darkSteelMat = track(new THREE.MeshStandardMaterial({ color: "#7d7d7d", metalness: 1, roughness: 0.3 }));
  const emberMat = track(
    new THREE.MeshStandardMaterial({ color: EMBER, metalness: 0.2, roughness: 0.35, emissive: EMBER, emissiveIntensity: 0.25 }),
  );

  /* ---------------------- Corpo (perfil torneado, oval) ---------------------- */
  // Perfil (raio x altura): base arredondada, cintura para pegada e ombro largo no topo.
  const profile = [
    [0.0, 0.0],
    [0.3, 0.0],
    [0.4, 0.04],
    [0.44, 0.12],
    [0.45, 0.35],
    [0.43, 0.7],
    [0.4, 1.05],
    [0.41, 1.35],
    [0.46, 1.7],
    [0.5, 1.95],
    [0.52, 2.08],
    [0.52, 2.12],
    [0.0, 2.12],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = track(new THREE.LatheGeometry(profile, 64));
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 1, 0.68); // seção oval, como uma máquina real
  body.castShadow = true;
  group.add(body);

  // Faixa de pegada emborrachada com sulcos
  const gripGeo = track(new THREE.CylinderGeometry(0.418, 0.43, 0.55, 64, 1, true));
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.y = 0.72;
  grip.scale.set(1.01, 1, 0.69);
  group.add(grip);
  const grooveGeo = track(new THREE.TorusGeometry(0.43, 0.012, 8, 64));
  for (let i = 0; i < 6; i++) {
    const groove = new THREE.Mesh(grooveGeo, goldMat);
    groove.rotation.x = Math.PI / 2;
    groove.scale.set(1, 0.69, 1);
    groove.position.y = 0.48 + i * 0.095;
    if (i === 0 || i === 5) group.add(groove);
  }

  // Anéis dourados (acabamento premium)
  const ringGeo = track(new THREE.TorusGeometry(0.505, 0.022, 12, 72));
  for (const y of [1.98, 0.16]) {
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(y > 1 ? 1.02 : 0.88, y > 1 ? 0.69 : 0.6, 1);
    ring.position.y = y;
    ring.castShadow = true;
    group.add(ring);
  }

  // Tampa da base dourada (saída do cabo)
  const capGeo = track(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 40));
  const cap = new THREE.Mesh(capGeo, goldMat);
  cap.position.y = -0.02;
  group.add(cap);

  /* ----------------------------- Cabeça de corte ----------------------------- */
  const headGeo = track(new RoundedBoxGeometry(1.04, 0.2, 0.62, 4, 0.06));
  const head = new THREE.Mesh(headGeo, darkSteelMat);
  head.position.y = 2.2;
  head.castShadow = true;
  group.add(head);

  // Lâmina fixa (prateada) com dentes instanciados
  const bladeGeo = track(new RoundedBoxGeometry(1.0, 0.14, 0.08, 2, 0.02));
  const blade = new THREE.Mesh(bladeGeo, steelMat);
  blade.position.set(0, 2.35, 0.2);
  blade.rotation.x = -0.12;
  group.add(blade);

  const teeth = 28;
  const toothGeo = track(new THREE.BoxGeometry(0.022, 0.14, 0.05));
  const toothMesh = new THREE.InstancedMesh(toothGeo, steelMat, teeth);
  const m = new THREE.Matrix4();
  for (let i = 0; i < teeth; i++) {
    const x = -0.47 + (0.94 * i) / (teeth - 1);
    m.makeRotationX(-0.12);
    m.setPosition(x, 2.47, 0.215);
    toothMesh.setMatrixAt(i, m);
  }
  toothMesh.castShadow = true;
  group.add(toothMesh);

  // Lâmina móvel (dourada) atrás
  const moving = new THREE.Mesh(track(new RoundedBoxGeometry(0.86, 0.1, 0.05, 2, 0.015)), goldMat);
  moving.position.set(0, 2.36, 0.11);
  moving.rotation.x = -0.12;
  group.add(moving);

  // Parafusos
  const screwGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16));
  for (const x of [-0.3, 0.3]) {
    const screw = new THREE.Mesh(screwGeo, goldMat);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x, 2.33, 0.25);
    group.add(screw);
  }

  /* --------------------------- Alavanca de ajuste --------------------------- */
  const leverArm = new THREE.Mesh(track(new RoundedBoxGeometry(0.08, 0.5, 0.06, 2, 0.02)), goldMat);
  leverArm.position.set(0.53, 1.78, 0.02);
  leverArm.rotation.z = -0.18;
  group.add(leverArm);
  const leverKnob = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 20, 16)), goldMat);
  leverKnob.position.set(0.58, 1.55, 0.02);
  group.add(leverKnob);

  /* --------------------- Botão liga/desliga (vermelho da marca) --------------------- */
  const switchBase = new THREE.Mesh(track(new RoundedBoxGeometry(0.2, 0.34, 0.06, 2, 0.03)), gripMat);
  switchBase.position.set(0, 1.25, 0.285);
  switchBase.rotation.x = -0.03;
  group.add(switchBase);
  const switchKnob = new THREE.Mesh(track(new RoundedBoxGeometry(0.12, 0.13, 0.06, 2, 0.025)), emberMat);
  switchKnob.position.set(0, 1.32, 0.31);
  group.add(switchKnob);

  /* ------------------------- Gravação da marca ------------------------- */
  const labelTex = track(brandLabelTexture());
  const labelMat = track(new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, metalness: 0.9, roughness: 0.3 }));
  // Plano levemente curvo acompanhando o corpo oval (a gravação não é encoberta).
  const labelGeo = track(new THREE.PlaneGeometry(0.56, 0.14, 24, 1));
  const lp = labelGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    lp.setZ(i, -(x * x) * 0.55);
  }
  labelGeo.computeVertexNormals();
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 1.62, 0.322);
  label.rotation.x = -0.06;
  group.add(label);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });

  return {
    group,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
