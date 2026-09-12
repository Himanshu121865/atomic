import { lazy, Suspense, useState } from "react";
import { useAppStore } from "../state/store";

const PhysicsBody = lazy(() => import("./PhysicsBody"));

export function ShowPhysics() {
  const view = useAppStore((s) => s.view);
  const [opened, setOpened] = useState(false);

  return (
    <details
      className="physics"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
    >
      <summary>Show the physics</summary>
      {opened && (
        <Suspense fallback={<p className="physics-note">typesetting...</p>}>
          <PhysicsBody view={view} />
        </Suspense>
      )}
    </details>
  );
}
