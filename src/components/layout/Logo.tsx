"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSalonSettings } from "./SalonSettingsProvider";

interface LogoProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

/**
 * Brand mark. Uses the logo uploaded in Configurações when there is one; otherwise the AUPALE
 * sublogo, swapping variant with the theme (CSS-only, so no flash on first paint).
 */
export default function Logo({ size = 44, showName = false, className }: LogoProps) {
  const { logoUrl, name, subtitle } = useSalonSettings();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const showCustom = !!logoUrl && !imgError;
  const dim = { width: size, height: size };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showCustom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="shrink-0 rounded-full object-contain"
          style={dim}
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-light.png"
            alt={name}
            className="shrink-0 object-contain dark:hidden"
            style={dim}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-dark.png"
            alt={name}
            className="hidden shrink-0 object-contain dark:block"
            style={dim}
          />
        </>
      )}
      {showName && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-lg tracking-[0.18em] text-text">
            {name.toUpperCase()}
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.22em] text-textDim">
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
