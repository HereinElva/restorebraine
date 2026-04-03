import React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

/**
 * A reusable bottom-sheet drawer for mobile menu items.
 * Props:
 *   open: boolean
 *   onOpenChange: (open) => void
 *   title?: string
 *   children: React.ReactNode
 */
export default function MobileDrawerMenu({ open, onOpenChange, title, children }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {title && (
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
        )}
        <div className="px-4 pb-6 space-y-1">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}