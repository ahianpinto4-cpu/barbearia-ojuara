"use client";
/* eslint-disable react-hooks/purity, react-hooks/immutability --
   Cena Three.js imperativa: objetos 3D são criados uma vez (com aleatoriedade
   nas partículas) e mutados a cada quadro dentro de useFrame, fora do ciclo de
   renderização do React. É o padrão recomendado do React Three Fiber. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildClipper, CLIPPER_HEIGHT } from "./clipperModel";

/**
 * Cena da abertura: aparecimento → queda com gravidade → impacto ("PUF")
 * com partículas douradas e vermelhas, onda de choque e poeira.
 */
export const TIMELINE = {
  appearEnd: 0.9, // CENA 1: surge no centro, girando
  fallStart: 1.0, // sobe rapidamente (antecipação) …
  dropStart: 1.3, // … e cai com gravidade
  impact: 1.78, // CENA 3: impacto
  exitStart: 2.3, // CENA 4: dá lugar à marca
};

const HOVER_Y = -0.75; // flutuando no centro da tela
const LIFT_Y = 1.25; // ponto alto antes da queda
const GROUND_Y = -1.15;

type Props = { lowPower: boolean; onImpact: () => void; onReady?: () => void };

function softDot(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function Scene({ lowPower, onImpact, onReady }: Props) {
  const { scene, gl, camera } = useThree();
  const clipper = useMemo(() => buildClipper(), []);
  const holder = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.SpotLight>(null);
  const flash = useRef<THREE.PointLight>(null);
  const ring = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const impacted = useRef(false);

  const particleCount = lowPower ? 220 : 560;
  const dot = useMemo(() => softDot(), []);

  // Partículas (faíscas douradas e avermelhadas)
  const sparks = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    const gold = new THREE.Color("#e0bd63");
    const ember = new THREE.Color("#ff4a1c");
    const white = new THREE.Color("#fff3d6");
    for (let i = 0; i < particleCount; i++) {
      const c = Math.random() < 0.62 ? gold : Math.random() < 0.75 ? ember : white;
      col.set([c.r, c.g, c.b], i * 3);
      const a = Math.random() * Math.PI * 2;
      const up = 0.15 + Math.random() * 0.95;
      const speed = 2.2 + Math.random() * 4.8;
      vel.set([Math.cos(a) * speed * (1 - up * 0.5), up * speed * 1.05, Math.sin(a) * speed * (1 - up * 0.5) * 0.7], i * 3);
      pos.set([0, GROUND_Y + 0.05, 0], i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: lowPower ? 0.09 : 0.075,
      map: dot,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points, vel, geo, mat };
  }, [particleCount, dot, lowPower]);

  // Poeira ("PUF"): sprites grandes e suaves
  const puffs = useMemo(() => {
    const n = lowPower ? 7 : 12;
    return Array.from({ length: n }, (_, i) => {
      const mat = new THREE.SpriteMaterial({
        map: dot,
        color: i % 3 === 0 ? "#6b2a17" : "#5c4a26",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      const a = (i / n) * Math.PI * 2;
      s.userData = { dir: new THREE.Vector3(Math.cos(a), 0.25 + Math.random() * 0.35, Math.sin(a) * 0.6), speed: 0.8 + Math.random() * 0.9 };
      s.position.set(0, GROUND_Y + 0.15, 0);
      return s;
    });
  }, [dot, lowPower]);

  const ground = useMemo(() => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.55 }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = GROUND_Y;
    g.receiveShadow = true;
    return g;
  }, []);

  // Ambiente para reflexos realistas nos metais
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(
    () => () => {
      clipper.dispose();
      sparks.geo.dispose();
      sparks.mat.dispose();
      puffs.forEach((p) => p.material.dispose());
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      dot.dispose();
    },
    [clipper, sparks, puffs, ground, dot],
  );

  const baseCam = useMemo(() => camera.position.clone(), [camera]);

  useFrame((state, delta) => {
    if (start.current === null) {
      start.current = state.clock.elapsedTime;
      onReady?.();
    }
    const t = state.clock.elapsedTime - start.current;
    const g = holder.current;
    if (!g) return;
    const { appearEnd, fallStart, dropStart, impact, exitStart } = TIMELINE;

    // Luz principal dourada acende
    if (keyLight.current) keyLight.current.intensity = 60 * easeOutCubic(clamp01(t / 0.9));

    if (t < fallStart) {
      // CENA 1 — aparecimento: surge no centro, girando devagar
      const k = easeOutCubic(clamp01(t / appearEnd));
      g.position.set(0, HOVER_Y - 0.35 * (1 - k) + Math.sin(t * 3) * 0.03, 0);
      g.scale.setScalar(0.6 + 0.4 * k);
      g.rotation.set(0.12, -1.1 + k * 1.1 + t * 0.4, 0.05);
    } else if (t < dropStart) {
      // Antecipação: sobe rápido, desacelerando no alto
      const k = easeOutCubic(clamp01((t - fallStart) / (dropStart - fallStart)));
      g.position.y = HOVER_Y + (LIFT_Y - HOVER_Y) * k;
      g.rotation.y += delta * 2.2;
    } else if (t < impact) {
      // CENA 2 — queda com aceleração natural (y = y0 − ½·g·t²)
      const ft = t - dropStart;
      const dur = impact - dropStart;
      const gAcc = (2 * (LIFT_Y - GROUND_Y)) / (dur * dur);
      g.position.y = LIFT_Y - 0.5 * gAcc * ft * ft;
      g.scale.setScalar(1);
      g.rotation.y += delta * (1.5 + ft * 9);
      g.rotation.x = 0.12 * (1 - ft / dur);
      g.rotation.z = 0.05 * (1 - ft / dur);
    } else {
      // CENA 3 — impacto
      if (!impacted.current) {
        impacted.current = true;
        onImpact();
      }
      const it = t - impact;
      g.position.y = GROUND_Y + Math.abs(Math.sin(it * 9)) * 0.18 * Math.exp(-it * 7);
      // deformação de impacto curta (squash & stretch), sem distorcer o modelo
      const squash = Math.exp(-it * 14) * Math.cos(it * 30) * 0.09;
      g.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      g.rotation.x = g.rotation.z = 0;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2, 6, delta);

      // CENA 4 — a máquina recua para dar lugar à marca
      if (t > exitStart) {
        const e = easeOutCubic(clamp01((t - exitStart) / 0.9));
        g.position.z = -e * 3;
        g.scale.multiplyScalar(1 - e * 0.35);
      }

      // Partículas
      const pos = sparks.geo.attributes.position as THREE.BufferAttribute;
      const k = 1.6; // arrasto do ar
      const f = (1 - Math.exp(-k * it)) / k;
      for (let i = 0; i < particleCount; i++) {
        pos.setXYZ(
          i,
          sparks.vel[i * 3] * f,
          Math.max(GROUND_Y, GROUND_Y + 0.05 + sparks.vel[i * 3 + 1] * f - 1.9 * it * it),
          sparks.vel[i * 3 + 2] * f,
        );
      }
      pos.needsUpdate = true;
      sparks.mat.opacity = it < 0.05 ? it / 0.05 : Math.max(0, 1 - (it - 0.05) / 1.5);

      // Onda de expansão
      if (ring.current) {
        const r = easeOutCubic(clamp01(it / 0.9));
        ring.current.scale.setScalar(0.3 + r * 7);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - r);
      }
      // Flash de luz
      if (flash.current) flash.current.intensity = 90 * Math.exp(-it * 7);
      // "PUF" de poeira
      puffs.forEach((p) => {
        const d = p.userData as { dir: THREE.Vector3; speed: number };
        const k = easeOutCubic(clamp01(it / 1.4));
        p.position.set(d.dir.x * k * 2.2 * d.speed, GROUND_Y + 0.15 + d.dir.y * k * 1.4, d.dir.z * k * 2.2 * d.speed);
        p.scale.setScalar(0.6 + k * 2.6);
        p.material.opacity = 0.55 * Math.exp(-it * 1.8) * clamp01(it / 0.08);
      });

      // Tremor de câmera curto e amortecido
      const shake = Math.exp(-it * 9) * 0.12;
      camera.position.set(baseCam.x + (Math.random() - 0.5) * shake, baseCam.y + (Math.random() - 0.5) * shake, baseCam.z);
    }
  });

  return (
    <>
      <color attach="background" args={["#080808"]} />
      <fog attach="fog" args={["#080808", 7, 16]} />
      <ambientLight intensity={0.12} />
      <spotLight
        ref={keyLight}
        position={[1.8, 6.5, 4.5]}
        angle={0.42}
        penumbra={0.85}
        color="#ffd88a"
        intensity={0}
        castShadow
        shadow-mapSize-width={lowPower ? 512 : 1024}
        shadow-mapSize-height={lowPower ? 512 : 1024}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4, 2, -3]} color="#ff5a2a" intensity={1.6} />
      <directionalLight position={[3, 1, 5]} color="#ffffff" intensity={0.35} />
      <pointLight ref={flash} position={[0, GROUND_Y + 0.6, 1.2]} color="#ffcf73" intensity={0} distance={8} />
      <group ref={holder}>
        <primitive object={clipper.group} position={[0, 0, 0]} />
      </group>
      <primitive object={ground} />
      <primitive object={sparks.points} />
      {puffs.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.01, 0]}>
        <ringGeometry args={[0.92, 1, 96]} />
        <meshBasicMaterial color="#e0bd63" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

export default function ClipperScene({ lowPower, onImpact, onReady }: Props) {
  return (
    <Canvas
      shadows
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      camera={{ position: [0, 0.45, 7.2], fov: 34, near: 0.1, far: 40 }}
      gl={{ antialias: !lowPower, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl, camera, size }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        // Em telas verticais (celular), afasta a câmera para a máquina caber com folga.
        const aspect = size.width / size.height;
        if (aspect < 1) camera.position.z = 7.2 + (1 - aspect) * 6.5;
        camera.lookAt(0, CLIPPER_HEIGHT * 0.06, 0);
      }}
    >
      <Scene lowPower={lowPower} onImpact={onImpact} onReady={onReady} />
    </Canvas>
  );
}
