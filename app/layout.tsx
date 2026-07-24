import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, Noto_Sans_Gujarati } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

// Editorial serif for display headings — the archival, characterful voice
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// Clean grotesk for UI + body
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

// Tabular mono for GR numbers, dates and other ledger data
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Dedicated face so the Gujarati register labels render beautifully
const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f0ede8",
};

export const metadata: Metadata = {
  title: {
    default: "Digital GR — School register, digitized",
    template: "%s · Digital GR",
  },
  description:
    "Turn handwritten school General Registers into a searchable, secure archive. Scan a page, let OCR read the Gujarati and English, and keep every record safe.",
  applicationName: "Digital GR",
  keywords: ["General Register", "school records", "OCR", "Gujarati", "digitization"],
  openGraph: {
    title: "Digital GR — School register, digitized",
    description:
      "Scan register pages, auto-extract student details, and manage records securely.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable} ${notoGujarati.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AuthProvider>
          <div id="main-content">{children}</div>
        </AuthProvider>

        {/* Archival paper grain — non-interactive film over the whole UI */}
        <div className="grain" aria-hidden="true" />

        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
