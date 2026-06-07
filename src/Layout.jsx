import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isGalleryPath, navigateToGallery } from "@/lib/gallery-nav";
import { Search, Upload, User, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { NavigationProvider, useNavigation } from "./components/NavigationContext";
import { TabStateProvider } from "./components/TabStateContext";
import { BUILD_NUMBER, WEB_BUILD_LABEL } from "@/lib/build-info";

const TAB_ORDER = ["Gallery", "Upload", "Account"];

function LayoutInner({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const prevIndexRef = useRef(0);
  const { backState, popBack } = useNavigation();

  const isTabActive = (name) => {
    if (name === 'Gallery') return isGalleryPath(location.pathname);
    return location.pathname === createPageUrl(name);
  };

  const currentIndex = TAB_ORDER.findIndex((name) => isTabActive(name));
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;
  const direction = activeIndex >= prevIndexRef.current ? 1 : -1;

  useEffect(() => {
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Dark mode detection
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (e) => document.documentElement.classList.toggle("dark", e.matches);
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Prevent overscroll bounce
  useEffect(() => {
    document.body.style.overscrollBehaviorY = "none";
    return () => { document.body.style.overscrollBehaviorY = ""; };
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
    navigateToGallery(navigate);
  };

  useEffect(() => {
    if (!isGalleryPath(location.pathname)) popBack();
  }, [location.pathname, popBack]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <style>{`
        :root {
          --primary: 250 70% 75%;
          --primary-dark: 250 65% 65%;
        }
        .safe-top { padding-top: env(safe-area-inset-top); }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        * { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"] { user-select: none; -webkit-user-select: none; }
      `}</style>

      {/* Top brand header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-purple-100 shadow-sm safe-top select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 relative">
            {/* Back button — shown on child routes */}
            {backState ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-purple-600 font-medium select-none absolute left-0"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">{backState.label}</span>
              </button>
            ) : null}

            {/* Centered brand logo — hide when back button is shown to avoid overlap */}
            <div className={`flex-1 flex justify-center ${backState ? 'invisible' : ''}`}>
              <Link to={createPageUrl("Gallery")} className="flex items-center gap-2 select-none group">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-300 to-purple-400 rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200 shadow-md">
                  <Search className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent select-none">
                  Restorebraine
                </span>
                <span className="ml-1 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 select-none">
                  v{BUILD_NUMBER || 65}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with slide transition */}
      <main className="pt-14 pb-20 safe-bottom overflow-hidden">
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
      </main>

      {/* Bottom Tab Bar — always visible (hide toggle removed; broken on iOS) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] select-none"
        aria-label="App navigation"
      >
        <div className="bg-white/90 backdrop-blur-xl border-t border-purple-100 shadow-lg safe-bottom">
          <p
            className="text-center text-xs font-semibold text-purple-600 pt-1 select-none tracking-wide"
            aria-label="App version"
          >
            Build {BUILD_NUMBER || 65}
          </p>
          <div className="flex items-stretch max-w-lg mx-auto">
            {tabs.map(({ name, icon: Icon, label }) => {
              const isActive = isTabActive(name);
              return (
                <Link
                  key={name}
                  to={name === 'Gallery' ? createPageUrl('Gallery') : createPageUrl(name)}
                  replace={isActive}
                  className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 select-none relative"
                >
                  <Icon
                    className={`w-5 h-5 transition-colors select-none ${
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
                  {isActive && (
                    <span className="absolute bottom-0 w-8 h-0.5 bg-purple-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
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