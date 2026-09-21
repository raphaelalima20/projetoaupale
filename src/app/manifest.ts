import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AUPALE — Salão de Beleza",
    short_name: "AUPALE",
    description: "Sistema de gestão do salão de beleza AUPALE",
    start_url: "/",
    display: "standalone",
    background_color: "#FCE8DD",
    theme_color: "#C7A593",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
