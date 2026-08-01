import React, { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const REFRESH_SAFETY_MS = 4000;
const REFRESH_MAX_MS = 5000;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setPull = (value) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  };

  const setRefreshState = (value) => {
    refreshingRef.current = value;
    setRefreshing(value);
  };

  const finishRefresh = () => {
    setRefreshState(false);
    setPull(0);
    startY.current = null;
  };

  const isModalOpen = () => document.body.classList.contains('modal-open');

  useEffect(() => {
    const scrollEl = document.getElementById('rb-app-scroll');
    if (!scrollEl) return undefined;

    const handleTouchStart = (e) => {
      if (isModalOpen() || refreshingRef.current) return;
      if (scrollEl.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (isModalOpen() || refreshingRef.current) return;
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && scrollEl.scrollTop <= 0) {
        const next = Math.min(delta * 0.5, THRESHOLD + 20);
        setPull(next);
        if (next > 8) e.preventDefault();
      } else if (delta <= 0) {
        setPull(0);
      }
    };

    const runRefresh = () => {
      setRefreshState(true);
      setPull(THRESHOLD);

      const safetyTimer = window.setTimeout(finishRefresh, REFRESH_SAFETY_MS);
      const refreshPromise = Promise.resolve(onRefreshRef.current?.());
      const timeoutPromise = new Promise((resolve) => {
        window.setTimeout(resolve, REFRESH_MAX_MS);
      });

      Promise.race([refreshPromise, timeoutPromise])
        .catch((error) => {
          console.warn('Pull-to-refresh failed:', error);
        })
        .finally(() => {
          window.clearTimeout(safetyTimer);
          finishRefresh();
        });
    };

    const handleTouchEnd = () => {
      if (isModalOpen()) {
        finishRefresh();
        return;
      }

      if (pullDistanceRef.current >= THRESHOLD && !refreshingRef.current) {
        runRefresh();
        return;
      }

      finishRefresh();
    };

    scrollEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    scrollEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener('touchstart', handleTouchStart);
      scrollEl.removeEventListener('touchmove', handleTouchMove);
      scrollEl.removeEventListener('touchend', handleTouchEnd);
      scrollEl.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  const indicatorVisible = pullDistance > 10 || refreshing;
  const contentOffset = refreshing ? THRESHOLD : pullDistance;

  return (
    <div className="relative">
      {indicatorVisible ? (
        <div
          className="pointer-events-none flex items-center justify-center text-purple-500"
          style={{
            height: refreshing ? 48 : Math.max(pullDistance, 32),
            marginBottom: refreshing ? 4 : 0,
          }}
        >
          <RefreshCw
            className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
            style={{
              transform: refreshing ? undefined : `rotate(${(pullDistance / THRESHOLD) * 180}deg)`,
            }}
          />
        </div>
      ) : null}
      <div style={{ transform: contentOffset ? `translateY(${Math.min(contentOffset, THRESHOLD)}px)` : undefined }}>
        {children}
      </div>
    </div>
  );
}
