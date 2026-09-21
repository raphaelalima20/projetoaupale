"use client";

import { useState, ReactNode } from "react";
import CollabSidebar, { COLLAB_NAV_ITEMS } from "@/components/layout/CollabSidebar";
import MobileHeader from "@/components/layout/MobileHeader";

export default function ColaboradoraLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <CollabSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <MobileHeader onMenuClick={() => setMobileOpen(true)} navItems={COLLAB_NAV_ITEMS} />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
