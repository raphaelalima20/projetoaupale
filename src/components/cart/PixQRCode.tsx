"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface PixQRCodeProps {
  payload: string;
  amount: number;
  /** Static QR image uploaded by the admin in Configurações — shown instead of the generated one when set. */
  qrImageUrl?: string | null;
}

export default function PixQRCode({ payload, amount, qrImageUrl }: PixQRCodeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-2xl text-gold-light">{formatCurrency(amount)}</p>
      <div className="rounded-card bg-white p-4">
        {qrImageUrl ? (
          <img src={qrImageUrl} alt="QR Code Pix" className="h-[200px] w-[200px] object-contain" />
        ) : (
          <QRCodeSVG value={payload} size={200} />
        )}
      </div>
      <Button variant="secondary" onClick={handleCopy} className="w-full">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Código copiado!" : "Copiar código Pix"}
      </Button>
    </div>
  );
}
