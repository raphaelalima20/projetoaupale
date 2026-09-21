"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CalendarDays, Gem, Receipt, LogOut, X } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import SpecialtyText from "@/components/collaborators/SpecialtyText";
import { useAuth } from "@/components/auth/AuthProvider";
import { getInitials, cn } from "@/lib/utils";

export const COLLAB_NAV_ITEMS = [
  { href: "/colaboradora/minha-agenda", label: "Minha Agenda", icon: Calendar },
  { href: "/colaboradora/agenda-geral", label: "Agenda Geral", icon: CalendarDays },
  { href: "/colaboradora/minhas-comissoes", label: "Minhas Comissões", icon: Gem },
  { href: "/colaboradora/meus-pagamentos", label: "Meus Pagamentos", icon: Receipt },
];

interface CollabSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function CollabSidebar({ mobileOpen, onClose }: CollabSidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-6">
        <Logo showName size={48} />
        <button
          onClick={onClose}
          aria-label="Fechar menu"
          className="rounded-btn p-1.5 text-textDim hover:bg-surface2 hover:text-text md:hidden"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {COLLAB_NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm transition duration-200",
                active
                  ? "bg-gold-dim text-gold-light"
                  : "text-textDim hover:bg-surface2 hover:text-text"
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold-dim text-xs font-medium text-gold-light">
            {getInitials(profile?.full_name) || "?"}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm text-text">{profile?.full_name || "—"}</p>
            <SpecialtyText specialty={profile?.specialty} className="block text-xs text-textDim" />
          </div>
        </div>
        <ThemeToggle showLabel />
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-5 py-3 text-sm text-textDim transition duration-200 hover:bg-surface2 hover:text-danger"
        >
          <LogOut size={18} strokeWidth={1.75} />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-[260px] shrink-0 border-r border-border bg-surface md:block">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-overlay/60 animate-fadeInOverlay"
            onClick={onClose}
          />
          <aside className="relative z-10 h-full w-[280px] animate-slideIn bg-surface">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
