import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <Link 
          to={createPageUrl("Gallery")} 
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gallery
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last Updated: December 3, 2025</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What We Collect</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Photos and videos you upload</li>
              <li>AI-generated descriptions and tags of your media</li>
              <li>Basic account information (email, name)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Data</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>To store and organize your media</li>
              <li>To analyze content with AI for searchability</li>
              <li>To process payments via Stripe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Sharing</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>We do not sell your data</li>
              <li>Media is analyzed by AI services to generate descriptions</li>
              <li>Payment processing is handled securely by Stripe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Security</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Your files are stored securely</li>
              <li>Only you can access your uploaded media</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>You can delete your media at any time</li>
              <li>Contact us to request account deletion</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}