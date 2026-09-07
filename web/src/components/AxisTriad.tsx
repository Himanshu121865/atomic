import { Line } from "@react-three/drei";

export function AxisTriad({ extent }: { extent: number }) {
  return (
    <group>
      <Line points={[[-extent, 0, 0], [extent, 0, 0]]} color="#e05555" lineWidth={1} />
      <Line points={[[0, -extent, 0], [0, extent, 0]]} color="#7dd87d" lineWidth={1} />
      <Line points={[[0, 0, -extent], [0, 0, extent]]} color="#6aa8ff" lineWidth={1} />
    </group>
  );
}
