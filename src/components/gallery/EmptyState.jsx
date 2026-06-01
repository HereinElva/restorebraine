import React from "react";
import { Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="max-w-md mx-auto">
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-purple-200 rounded-3xl flex items-center justify-center">
            <Upload className="w-12 h-12 text-purple-500" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center animate-bounce">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 mb-3">
          No Media Yet
        </h3>
        <p className="text-gray-600 mb-8">
          Upload photos and videos — AI tags what it sees so you can search by physical description. Type &quot;grass&quot; to find field photos, or &quot;beach&quot; for ocean scenes.
        </p>

        <Link to={createPageUrl("Upload")}>
          <Button className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 gap-2">
            <Upload className="w-4 h-4" />
            Upload Your First Files
          </Button>
        </Link>

        <div className="mt-12 p-6 bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl text-left">
          <h4 className="font-semibold text-gray-900 mb-3">What you can search for:</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>"Beach sunset with palm trees"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>"People laughing at a party"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>"Red car parked on street"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>"Dog playing in snow"</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}