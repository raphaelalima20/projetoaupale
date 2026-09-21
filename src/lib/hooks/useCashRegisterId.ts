"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Role-agnostic "is the cash register open" check, backed by /api/cash-register/status.
 * Collaborators can't read cash_register directly (RLS is admin-only), so this is the
 * only reliable way for their agenda screens to gate appointment conclusion.
 */
export function useCashRegisterId() {
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-register/status");
      if (!res.ok) {
        setRegisterId(null);
        return;
      }
      const body = await res.json();
      setRegisterId(body.registerId ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { registerId, loading, refetch };
}
