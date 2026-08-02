import React, { useState } from "react";
import { Search } from "lucide-react";

/** Signed-out home — fixed header via Layout; hero stays visible (no login sheet overlay). */
export default function SignedOutLanding({ onSignIn }) {
  const [opening, setOpening] = useState(false);

  const handleSignIn = () => {
    setOpening(true);
    onSignIn();
    window.setTimeout(() => setOpening(false), 10000);
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] pb-4">
      <div className="px-4 pt-2 pb-1">
        <h1 className="text-xl font-bold text-gray-900">
          Find Your{" "}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Memories
          </span>
        </h1>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 opacity-80">
          <Search className="w-4 h-4 text-blue-300 flex-shrink-0" />
          <span className="text-base text-gray-400">Search memories...</span>
        </div>
      </div>

      <div className="px-4 text-center py-12">
        <p className="text-gray-600 text-sm max-w-xs mx-auto">
          Sign in to upload photos and videos, organize folders, and search your library.
        </p>
      </div>

      <div
        className="fixed left-0 right-0 z-[90] px-4"
        style={{ bottom: "calc(var(--rb-tab-bar, 2.75rem) + 0.5rem)" }}
      >
        <button
          type="button"
          onClick={handleSignIn}
          disabled={opening}
          className="w-full max-w-lg mx-auto block py-3.5 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-500 text-white font-semibold text-base shadow-lg disabled:opacity-80"
        >
          {opening ? "Opening sign in…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}
