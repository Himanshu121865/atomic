import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { PHYSICS_TO_SCREEN } from "../lib/frame";

interface Props {
  vertices: Float32Array;
  triangles: Uint32Array;
  colors: Float32Array;
}

export function IsoSurface({ vertices, triangles, colors }: Props) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(triangles, 1));
    g.computeVertexNormals();
    return g;
  }, [vertices, triangles, colors]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation={PHYSICS_TO_SCREEN}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.62}
        roughness={0.45}
        metalness={0.0}
      />
    </mesh>
  );
}
