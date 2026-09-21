"use client";

import Link from "next/link";
import { CalendarPlus, ShoppingBag, ChevronRight, Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import Logo from "@/components/layout/Logo";
import { useSalonSettings } from "@/components/layout/SalonSettingsProvider";

/** "08:00:00" → "08h", "08:30:00" → "08h30" */
function hourLabel(time: string): string {
  const [h, m] = time.split(":");
  return m && m !== "00" ? `${h}h${m}` : `${h}h`;
}

export default function ClienteHomePage() {
  const { name, subtitle, openingTime, closingTime } = useSalonSettings();

  return (
    <div className="animate-fadeIn">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <Logo size={120} />
        <h1 className="mt-3 font-display text-3xl tracking-[0.2em] text-text">
          {name.toUpperCase()}
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] text-textDim">{subtitle}</p>
        {openingTime && closingTime && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-textDim">
            <Clock size={13} />
            Seg a Sáb · {hourLabel(openingTime)} às {hourLabel(closingTime)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/cliente/agendar">
          <Card className="flex h-full items-center justify-between transition duration-200 hover:border-gold">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-dim">
                <CalendarPlus size={22} className="text-gold" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-display text-lg text-text">Agendar Horário</p>
                <p className="text-sm text-textDim">Escolha serviço, data e horário</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-textDim" />
          </Card>
        </Link>

        <Link href="/cliente/catalogo">
          <Card className="flex h-full items-center justify-between transition duration-200 hover:border-gold">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-dim">
                <ShoppingBag size={22} className="text-gold" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-display text-lg text-text">Catálogo & Loja</p>
                <p className="text-sm text-textDim">Pacotes e produtos</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-textDim" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
