"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { useSalonSettings } from "./SalonSettingsProvider";

interface NavItem {
  href: string;
  label: string;
}

interface MobileHeaderProps {
  onMenuClick: () => void;
  navItems: NavItem[];
}

export default function MobileHeader({ onMenuClick, navItems }: MobileHeaderProps) {
  const pathname = usePathname();
  const { name } = useSalonSettings();
  const current = navItems.find((item) => pathname?.startsWith(item.href));

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
      <button
        onClick={onMenuClick}
        aria-label="Abrir menu"
        className="rounded-btn p-2 text-text hover:bg-surface2"
      >
        <Menu size={22} />
      </button>
      <span className="font-display text-base text-text">
        {current?.label ?? name}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Logo size={32} />
      </div>
    </header>
  );
}
