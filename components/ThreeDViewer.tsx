"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GCodeLoader } from "three/examples/jsm/loaders/GCodeLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

type SupportedType = "STL" | "3MF" | "OBJ" | "GCODE" | "STEP" | "STP";
type StepMesh = {
  name?: string;
  color?: [number, number, number];
  attributes: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index?: { array: number[] };
};

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material?.dispose();
  });
}

function stepObject(meshes: StepMesh[]) {
  const group = new THREE.Group();
  for (const source of meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(source.attributes.position.array, 3));
    if (source.attributes.normal?.array?.length) {
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(source.attributes.normal.array, 3));
    } else {
      geometry.computeVertexNormals();
    }
    if (source.index?.array?.length) geometry.setIndex(source.index.array.flat());
    const colour = source.color
      ? new THREE.Color(source.color[0] / 255, source.color[1] / 255, source.color[2] / 255)
      : new THREE.Color(0xf5a623);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.62, metalness: 0.08, side: THREE.DoubleSide }),
    );
    mesh.name = source.name || "STEP part";
    group.add(mesh);
  }
  return group;
}

export default function ThreeDViewer({ fileId, fileName, fileType, sourceUrl }: {
  fileId?: string;
  fileName: string;
  fileType: SupportedType;
  sourceUrl?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState(`Loading ${fileType}…`);
  const [error, setError] = useState("");

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07111f);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x203040, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1, 2, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf5a623, 1.2);
    fill.position.set(-2, -1, 1);
    scene.add(fill);
    const grid = new THREE.GridHelper(200, 20, 0x38516f, 0x1c2c42);
    scene.add(grid);

    let frame = 0;
    let model: THREE.Object3D | undefined;
    let disposed = false;
    const resize = () => {
      const width = Math.max(container.clientWidth, 320);
      const height = Math.max(container.clientHeight, 420);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    async function load() {
      const response = await fetch(
        sourceUrl || (fileType === "STEP" || fileType === "STP"
          ? `/api/uploads/${fileId}/preview`
          : `/api/uploads/${fileId}`),
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `TITAN could not load this ${fileType} file.`);
      }
      if (fileType === "STEP" || fileType === "STP") {
        const data = await response.json() as { meshes?: StepMesh[] };
        if (!data.meshes?.length) throw new Error("This STEP/STP file does not contain viewable geometry.");
        return stepObject(data.meshes);
      }
      const buffer = await response.arrayBuffer();
      if (fileType === "STL") {
        const geometry = new STLLoader().parse(buffer);
        geometry.computeVertexNormals();
        return new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.62, metalness: 0.08, side: THREE.DoubleSide }),
        );
      }
      if (fileType === "3MF") return new ThreeMFLoader().parse(buffer);
      const source = new TextDecoder().decode(buffer);
      if (fileType === "OBJ") return new OBJLoader().parse(source);
      return new GCodeLoader().parse(source);
    }

    load().then((loaded) => {
      if (disposed) {
        disposeObject(loaded);
        return;
      }
      model = loaded;
      const initialBox = new THREE.Box3().setFromObject(model);
      if (initialBox.isEmpty()) throw new Error(`This ${fileType} file does not contain viewable geometry.`);
      const center = initialBox.getCenter(new THREE.Vector3());
      model.position.sub(center);
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const triangleCount = { value: 0 };
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.geometry) return;
        triangleCount.value += mesh.geometry.index
          ? mesh.geometry.index.count / 3
          : (mesh.geometry.attributes.position?.count || 0) / 3;
        if ((mesh as THREE.Mesh).isMesh && !(mesh.material instanceof THREE.MeshStandardMaterial)) {
          if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(() => new THREE.MeshStandardMaterial({ color: 0xf5a623, side: THREE.DoubleSide }));
        }
      });
      const radius = Math.max(size.length() / 2, 1);
      camera.position.set(radius * 1.55, radius * 1.15, radius * 1.55);
      camera.near = Math.max(radius / 1000, 0.01);
      camera.far = Math.max(radius * 100, 1000);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.minDistance = radius * 0.15;
      controls.maxDistance = radius * 20;
      controls.update();
      grid.scale.setScalar(Math.max(radius / 100, 0.1));
      setDetails(
        `${fileName} · ${fileType} · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm` +
        (triangleCount.value ? ` · ${Math.round(triangleCount.value).toLocaleString()} triangles` : ""),
      );
    }).catch((reason) => setError(reason instanceof Error ? reason.message : `Unable to display this ${fileType}.`));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (model) disposeObject(model);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fileId, fileName, fileType, sourceUrl]);

  return (
    <div>
      <div ref={host} className="stlViewer" />
      {error ? <div className="alert">{error}</div> : <p className="muted">{details}</p>}
      <p className="muted">Left-drag to rotate · scroll to zoom · right-drag to pan</p>
    </div>
  );
}
