import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, AlertTriangle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigation } from "@/components/NavigationContext";
import { navigateToGalleryFromAccount } from "@/lib/gallery-back-nav";
import { isHostedAppOrigin, isNativeShell } from "@/lib/native-hosted-redirect";

export default function Account() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { popBack } = useNavigation();
  const { logout, localLogout, resumeActiveSession } = useAuth();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  useEffect(() => {
    popBack();
  }, [popBack]);

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    queryClient.clear();
    try {
      if (isNativeShell() && !isHostedAppOrigin()) {
        await localLogout();
      } else {
        await logout();
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const photos = await base44.entities.Photo.list();
      await Promise.all(photos.map(photo => base44.entities.Photo.delete(photo.id)));
      const folders = await base44.entities.Folder.list();
      await Promise.all(folders.map(folder => base44.entities.Folder.delete(folder.id)));
      handleLogout();
    } catch (error) {
      alert("Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  const goToGallery = () => {
    void navigateToGalleryFromAccount(navigate, { popBack, resumeActiveSession });
  };

  return (
    <div className="relative z-0 min-h-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-4 pb-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          data-rb-gallery-nav="back"
          onClick={goToGallery}
          className="inline-flex items-center mb-4 relative z-10 min-h-[44px] px-2 -ml-2 text-purple-600 font-medium hover:text-purple-700 bg-transparent border-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Gallery
        </button>
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Account Settings</h1>
          {user && (
            <div className="mb-8 p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Email</p>
              <p className="font-medium text-gray-900">{user.email}</p>
            </div>
          )}
          <div data-rb-sign-out-row className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">Sign Out</h3>
              <p className="text-sm text-gray-600 mt-0.5">Sign out of your Restorebraine account</p>
            </div>
            <Button
              type="button"
              data-rb-sign-out
              onClick={() => {
                if (isNativeShell() && !isHostedAppOrigin()) {
                  void handleLogout();
                  return;
                }
                setShowLogoutDialog(true);
              }}
              variant="outline"
              className="gap-2 border-gray-300 flex-shrink-0 relative z-10"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
          <div className="border-t pt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Danger Zone
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Delete Account</h3>
              <p className="text-sm text-gray-600 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
              <Button onClick={() => setShowDeleteDialog(true)} variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete My Account
              </Button>
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access your photos and folders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-gray-900 hover:bg-gray-800">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete your account and all your photos, videos, and folders.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
