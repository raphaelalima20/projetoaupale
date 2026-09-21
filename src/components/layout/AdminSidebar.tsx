"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  FileBarChart,
  Gem,
  Receipt,
  Users,
  UserRound,
  Scissors,
  ShoppingBag,
  Package,
  PackageCheck,
  Eye,
  LogOut,
  X,
} from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { getInitials, cn } from "@/lib/utils";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/admin/caixa", label: "Fluxo de Caixa", icon: Wallet },
  { href: "/admin/relatorios-caixa", label: "Relatórios de Caixa", icon: FileBarChart },
  { href: "/admin/comissoes", label: "Comissões", icon: Gem },
  { href: "/admin/relatorios-pagamentos", label: "Relatório de Pagamentos", icon: Receipt },
  { href: "/admin/colaboradoras", label: "Colaboradoras", icon: Users },
  { href: "/admin/clientes", label: "Clientes", icon: UserRound },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors },
  { href: "/admin/produtos", label: "Produtos", icon: ShoppingBag },
  { href: "/admin/estoque", label: "Estoque", icon: Package },
  { href: "/admin/pacotes", label: "Pacotes", icon: PackageCheck },
];

interface AdminSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ mobileOpen, onClose }: AdminSidebarProps) {
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
        {ADMIN_NAV_ITEMS.map((item) => {
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

      <div className="px-3 pb-3">
        <a
          href="/cliente"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-btn border border-gold/30 px-3 py-2.5 text-sm text-gold transition duration-200 hover:bg-gold-dim"
        >
          <Eye size={18} strokeWidth={1.75} />
          <span>Ver como Cliente</span>
        </a>
      </div>

      <div className="border-t border-border">
        <Link
          href="/admin/configuracoes"
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-4 transition duration-200 hover:bg-surface2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold-dim text-xs font-medium text-gold-light">
            {getInitials(profile?.full_name) || "?"}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm text-text">{profile?.full_name || "—"}</p>
            <p className="text-xs text-textDim">Administradora</p>
          </div>
        </Link>
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
      {/* Desktop */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border bg-surface md:block">
        {content}
      </aside>

      {/* Mobile drawer */}
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
