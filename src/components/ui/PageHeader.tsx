"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {back && (
          <button
            onClick={() => router.back()}
            aria-label="Voltar"
            className="mt-1 rounded-btn border border-border p-2 text-textDim transition duration-200 hover:border-gold hover:text-gold"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="font-display text-2xl text-text sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-textDim">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
