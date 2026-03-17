"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ParseResult } from "@/components/processing/results-view";

export type ImportType = "mirror" | "13th" | "vacation";
export type ProcessingStatus = "idle" | "processing" | "done" | "error";

export interface TabState {
  files: File[];
  status: ProcessingStatus;
  result: ParseResult | null;
  errorMessage: string | null;
}

export const makeEmptyTab = (): TabState => ({
  files: [],
  status: "idle",
  result: null,
  errorMessage: null,
});

interface ProcessingCtx {
  activeTab: ImportType;
  setActiveTab: (t: ImportType) => void;
  tabs: Record<ImportType, TabState>;
  patchTab: (type: ImportType, patch: Partial<TabState>) => void;
  resetTab: (type: ImportType) => void;
}

const ProcessingContext = createContext<ProcessingCtx>({
  activeTab: "mirror",
  setActiveTab: () => {},
  tabs: {
    mirror: makeEmptyTab(),
    "13th": makeEmptyTab(),
    vacation: makeEmptyTab(),
  },
  patchTab: () => {},
  resetTab: () => {},
});

export function ProcessingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<ImportType>("mirror");
  const [tabs, setTabs] = useState<Record<ImportType, TabState>>({
    mirror: makeEmptyTab(),
    "13th": makeEmptyTab(),
    vacation: makeEmptyTab(),
  });

  const patchTab = useCallback(
    (type: ImportType, patch: Partial<TabState>) =>
      setTabs((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } })),
    [],
  );

  const resetTab = useCallback(
    (type: ImportType) =>
      setTabs((prev) => ({ ...prev, [type]: makeEmptyTab() })),
    [],
  );

  return (
    <ProcessingContext.Provider
      value={{ activeTab, setActiveTab, tabs, patchTab, resetTab }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export const useProcessing = () => useContext(ProcessingContext);
