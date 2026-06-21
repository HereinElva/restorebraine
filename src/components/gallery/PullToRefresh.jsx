import React, { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const REFRESH_SAFETY_MS = 6000;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

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

  const finishRefresh = () => {
    setRefreshing(false);
    setPullDistance(0);
    startY.current = null;
  };

  const handleTouchEnd = () => {
    if (isModalOpen()) {
      finishRefresh();
      return;
    }

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      const safetyTimer = setTimeout(finishRefresh, REFRESH_SAFETY_MS);

      Promise.resolve()
        .then(() => onRefreshRef.current?.())
        .catch((error) => {
          console.warn('Pull-to-refresh failed:', error);
        })
        .finally(() => {
          clearTimeout(safetyTimer);
          finishRefresh();
        });
      return;
    }

    finishRefresh();
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
            style={{ transform: refreshing ? undefined : `rotate(${(pullDistance / THRESHOLD) * 180}deg)` }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
