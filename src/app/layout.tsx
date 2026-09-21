import type { Metadata, Viewport } from "next";
import { Playfair_Display, Montserrat } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";
import SalonSettingsProvider from "@/components/layout/SalonSettingsProvider";
import ThemeProvider from "@/components/layout/ThemeProvider";
import ToastProvider from "@/components/ui/Toast";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AUPALE — Salão de Beleza",
  description: "Sistema de gestão do salão de beleza AUPALE",
  openGraph: {
    title: "AUPALE — Salão de Beleza",
    description: "Sistema de gestão do salão de beleza AUPALE",
    siteName: "AUPALE",
    locale: "pt_BR",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AUPALE",
  },
};

export const viewport: Viewport = {
  themeColor: "#C7A593",
};

/** Applies the saved theme before first paint so there is no light-to-dark flash. */
const themeInitScript = `(function(){try{if(localStorage.getItem("aupale-theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${playfair.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-text antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>
            <SalonSettingsProvider>
              <AuthProvider>{children}</AuthProvider>
            </SalonSettingsProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
