"use client";

import { Float, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import { clamp01, lerp } from "@/lib/animation";
import type { NodeType } from "@/types/davinci";

type FloatingNodeProps = {
  node: NodeType;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  delay?: number;
};

export function FloatingNode({
  node,
  onSelect,
  selected,
  delay = 0,
}: FloatingNodeProps) {
  const shellRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const isTopic = node.category === "topic";
  const radius = isTopic ? 0.78 : 0.42;
  const nodeColor = node.accent ?? (isTopic ? "#1a1208" : "#8b6c42");
  const haloColor = isTopic ? "#6b4f2f" : "#d4b896";

  useFrame((state, delta) => {
    if (!shellRef.current) {
      return;
    }

    if (startedAtRef.current === null) {
      startedAtRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startedAtRef.current;
    const reveal = clamp01((elapsed - delay) / 0.42);
    const targetScale = selected ? 1.16 : hovered ? 1.06 : 1;
    const nextScale = lerp(
      shellRef.current.scale.x,
      targetScale * reveal,
      1 - Math.exp(-delta * 8),
    );

    shellRef.current.scale.setScalar(nextScale);
    shellRef.current.rotation.y += delta * (isTopic ? 0.1 : 0.14);
    shellRef.current.position.y =
      Math.sin(state.clock.elapsedTime * 0.7 + radius) * 0.045 * reveal;
  });

  return (
    <group position={node.position}>
      <Float
        speed={selected ? 2 : 1.2}
        rotationIntensity={0.1}
        floatIntensity={selected ? 0.26 : 0.18}
      >
        <group ref={shellRef}>
          <mesh
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
          >
            <octahedronGeometry args={[radius, 0]} />
            <meshStandardMaterial
              color={nodeColor}
              emissive={nodeColor}
              emissiveIntensity={selected ? 0.08 : hovered ? 0.03 : 0.01}
              metalness={0.04}
              roughness={0.52}
              transparent
              opacity={0.96}
            />
          </mesh>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 1.45, isTopic ? 0.018 : 0.012, 8, 40]} />
            <meshBasicMaterial
              color={haloColor}
              transparent
              opacity={selected ? 0.35 : hovered ? 0.22 : 0.12}
            />
          </mesh>

          <Text
            position={[0, radius + (isTopic ? 0.48 : 0.34), 0]}
            fontSize={isTopic ? 0.34 : 0.22}
            maxWidth={2.6}
            textAlign="center"
            color={nodeColor}
            anchorX="center"
            anchorY="middle"
          >
            {node.label}
          </Text>
        </group>
      </Float>
    </group>
  );
}
