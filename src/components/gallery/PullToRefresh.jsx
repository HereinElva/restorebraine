import React, { useCallback, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const REFRESH_SAFETY_MS = 6000;
const REFRESH_DONE_MS = 2500;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setPull = useCallback((value) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }, []);

  const setRefreshState = useCallback((value) => {
    refreshingRef.current = value;
    setRefreshing(value);
  }, []);

  const finishRefresh = useCallback(() => {
    setRefreshState(false);
    setPull(0);
    startY.current = null;
  }, [setPull, setRefreshState]);

  const isModalOpen = () => document.body.classList.contains('modal-open');

  const getScrollEl = () => document.getElementById('rb-app-scroll') || document.documentElement;

  const handleTouchStart = (e) => {
    if (isModalOpen() || refreshingRef.current) return;
    if (getScrollEl().scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (isModalOpen() || refreshingRef.current) return;
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && getScrollEl().scrollTop <= 0) {
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

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      finishRefresh();
    };

    window.setTimeout(done, REFRESH_DONE_MS);
    window.setTimeout(done, REFRESH_SAFETY_MS);
    Promise.resolve(onRefreshRef.current?.())
      .catch((error) => {
        console.warn('Pull-to-refresh failed:', error);
      })
      .finally(done);
  };

  const handleTouchEnd = () => {
    if (isModalOpen()) {
      finishRefresh();
      return;
    }

    if (refreshingRef.current) {
      return;
    }

    if (pullDistanceRef.current >= THRESHOLD) {
      runRefresh();
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
      onTouchCancel={handleTouchEnd}
      className="relative"
    >
      {indicatorVisible ? (
        <div
          className="pointer-events-none flex items-center justify-center text-purple-500"
          style={{
            height: refreshing ? 40 : Math.max(pullDistance, 28),
            marginBottom: refreshing ? 2 : 0,
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
      {children}
    </div>
  );
}
