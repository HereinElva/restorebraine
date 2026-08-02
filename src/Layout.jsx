import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isGalleryPath, navigateToGallery, persistActiveSession } from "@/lib/gallery-nav";
import { useAuth } from "@/lib/AuthContext";
import { getRestorebraineAppLogo } from "@/lib/app-branding";
import { Search, Upload, User, ChevronLeft } from "lucide-react";
import { resetAppScrollPosition } from "@/lib/scroll-reset";
import { AnimatePresence, motion } from "framer-motion";
import { NavigationProvider, useNavigation } from "./components/NavigationContext";
import { TabStateProvider } from "./components/TabStateContext";
import { BrandGradientDefs } from "@/components/ui/BrandGradientIcon";

const TAB_ORDER = ["Gallery", "Upload", "Account"];
const HEADER_BAR_PX = 36;

const useLocalNativeBundle = () => {
  try {
    return typeof __RESTOREBRAINE_NATIVE_LOCAL__ !== "undefined" && __RESTOREBRAINE_NATIVE_LOCAL__;
  } catch {
    return false;
  }
};

function LayoutInner({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const prevIndexRef = useRef(0);
  const mainScrollRef = useRef(null);
  const { backState, popBack } = useNavigation();
  const { resumeActiveSession } = useAuth();
  const localNativeBundle = useLocalNativeBundle();

  const isTabActive = (name) => {
    if (name === "Gallery") return isGalleryPath(location.pathname);
    return location.pathname === createPageUrl(name);
  };

  const currentIndex = TAB_ORDER.findIndex((name) => isTabActive(name));
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;
  const direction = activeIndex >= prevIndexRef.current ? 1 : -1;

  useEffect(() => {
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    resetAppScrollPosition();
    requestAnimationFrame(resetAppScrollPosition);
    const t = window.setTimeout(resetAppScrollPosition, 50);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    resetAppScrollPosition();
  }, []);

  useEffect(() => {
    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overscrollBehaviorY = "";
      document.documentElement.style.height = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
    };
  }, []);

  const tabs = [
    { name: "Gallery", icon: Search, label: "Search" },
    { name: "Upload", icon: Upload, label: "Upload" },
    { name: "Account", icon: User, label: "Account" },
  ];

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  const handleBack = () => {
    if (!backState) return;

    if (isGalleryPath(location.pathname)) {
      backState.onBack();
      popBack();
      return;
    }

    popBack();
    navigateToGallery(navigate, { resumeActiveSession });
  };

  useEffect(() => {
    if (!isGalleryPath(location.pathname)) popBack();
  }, [location.pathname, popBack]);

  const pageContent = localNativeBundle ? (
    <div key={location.pathname}>{children}</div>
  ) : (
    <AnimatePresence custom={direction} mode="wait">
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-hidden">
      <BrandGradientDefs />
      <style>{`
        :root {
          --rb-header-bar: ${HEADER_BAR_PX}px;
          --rb-header-total: calc(var(--rb-header-bar) + env(safe-area-inset-top, 0px));
          --rb-tab-bar: calc(2.75rem + env(safe-area-inset-bottom, 0px));
        }
        * { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"] { user-select: none; -webkit-user-select: none; }
      `}</style>

      <header
        className="flex-shrink-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-100 shadow-sm select-none"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center h-9 relative">
            {backState ? (
              <button
                type="button"
                data-rb-gallery-nav="header-back"
                onClick={handleBack}
                className="flex items-center gap-1 text-purple-600 font-medium select-none absolute left-0 z-10 py-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">{backState.label}</span>
              </button>
            ) : null}

            <div className={`flex-1 flex justify-center ${backState ? "invisible" : ""}`}>
              <Link
                to={createPageUrl("Gallery")}
                replace
                data-rb-gallery-nav="header-logo"
                className="flex items-center gap-1 select-none group py-1"
              >
                <img
                  src={getRestorebraineAppLogo()}
                  alt="Restorebraine"
                  data-rb-logo="1"
                  className="w-6 h-6 rounded-md object-cover shadow-sm"
                />
                <span className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent select-none">
                  Restorebraine
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main
        id="rb-app-scroll"
        ref={mainScrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain -webkit-overflow-scrolling-touch"
      >
        {pageContent}
      </main>

      <nav
        className="flex-shrink-0 z-[100] select-none bg-white/90 backdrop-blur-xl border-t border-purple-100 shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="App navigation"
      >
        <div className="flex items-stretch max-w-lg mx-auto">
          {tabs.map(({ name, icon: Icon, label }) => {
            const isActive = isTabActive(name);
            const galleryTarget = name === "Gallery" ? createPageUrl("Gallery") : createPageUrl(name);
            return (
              <Link
                key={name}
                to={galleryTarget}
                replace={isActive}
                data-rb-gallery-nav={name === "Gallery" ? "tab" : undefined}
                onClick={() => {
                  popBack();
                  resetAppScrollPosition();
                  if (name === "Gallery") {
                    void persistActiveSession().then(() => resumeActiveSession?.());
                  }
                }}
                className="flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 select-none relative"
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-colors select-none ${
                    isActive ? "text-purple-600" : "text-gray-400"
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors select-none ${
                    isActive ? "text-purple-600" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
                {isActive ? (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-purple-500 rounded-full" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <TabStateProvider>
      <NavigationProvider>
        <LayoutInner currentPageName={currentPageName} children={children} />
      </NavigationProvider>
    </TabStateProvider>
  );
}
