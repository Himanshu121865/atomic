import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { toScreen } from "../lib/cloudColors";

export function PointCloud({
  positions,
  colors,
  size = 0.12,
}: {
  positions: Float32Array;
  colors: Float32Array;
  size?: number;
}) {
  const geometry = useMemo(() => {
    const n = positions.length / 3;
    const rotated = new Float32Array(positions.length);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = toScreen([positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]);
      rotated[3 * i] = x;
      rotated[3 * i + 1] = y;
      rotated[3 * i + 2] = z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(rotated, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={size} vertexColors sizeAttenuation={false} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}
