import React, { createContext, useContext, useRef } from "react";

/**
 * Persists arbitrary state per-tab so that switching tabs doesn't lose in-page state
 * (e.g. which folder is open in Gallery).
 * Usage:
 *   const { getTabState, setTabState } = useTabState();
 *   const state = getTabState("Gallery") ?? {};
 *   setTabState("Gallery", { selectedFolder: ... });
 */
const TabStateContext = createContext(null);

export function TabStateProvider({ children }) {
  // Use a ref so updates don't re-render everything
  const storeRef = useRef({});

  const getTabState = (tab) => storeRef.current[tab] ?? null;
  const setTabState = (tab, value) => { storeRef.current[tab] = value; };

  return (
    <TabStateContext.Provider value={{ getTabState, setTabState }}>
      {children}
    </TabStateContext.Provider>
  );
}

export function useTabState() {
  return useContext(TabStateContext);
}