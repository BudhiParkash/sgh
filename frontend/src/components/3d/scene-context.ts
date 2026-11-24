"use client";

import { createContext, useContext } from "react";

export const SceneLifecycleContext = createContext<{ onReady: () => void; onContextLost: () => void }>({
  onReady: () => {},
  onContextLost: () => {},
});

export const useSceneLifecycle = () => useContext(SceneLifecycleContext);
