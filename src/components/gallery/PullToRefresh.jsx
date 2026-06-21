import React, { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  const isModalOpen = () => document.body.classList.contains('modal-open');

  const handleTouchStart = (e) => {
    if (isModalOpen()) return;
    const scrollEl = document.getElementById('rb-app-scroll') || document.documentElement;
    if (scrollEl.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (isModalOpen()) return;
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (isModalOpen()) return;
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
    startY.current = null;
  };

  const indicatorVisible = pullDistance > 10 || refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {indicatorVisible ? (
        <div
          className="pointer-events-none fixed left-0 right-0 z-[60] flex items-center justify-center"
          style={{
            top: 'var(--rb-header-total, 3.5rem)',
            height: refreshing ? 48 : Math.max(pullDistance, 32),
          }}
        >
          <RefreshCw
            className={`w-5 h-5 text-purple-500 ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${(pullDistance / THRESHOLD) * 180}deg)` }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
