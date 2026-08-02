import React, { createContext, useContext, useState, useCallback } from "react";

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [backState, setBackState] = useState(null);
  // backState: { label: string, onBack: () => void } | null

  const pushBack = useCallback((label, onBack) => {
    setBackState({ label, onBack });
  }, []);

  const popBack = useCallback(() => {
    setBackState(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ backState, pushBack, popBack }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    return { backState: null, pushBack: () => {}, popBack: () => {} };
  }
  return ctx;
}