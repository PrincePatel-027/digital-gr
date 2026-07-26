import type { Metadata, Viewport } from "next";
import {
  Spectral,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Noto_Sans_Gujarati,
  Noto_Serif_Gujarati,
} from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

// Display: a bookish transitional serif, the voice of an official bound register.
const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Body/UI: institutional and clerical rather than startup-neutral.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Ledger figures: GR numbers, dates, counts — tabular by design.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Gujarati body text as written into the register.
const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Gujarati serif for the printed column captions (પત્રક ૪ / પત્રક ૫ headers).
const notoGujaratiSerif = Noto_Serif_Gujarati({
  variable: "--font-noto-gujarati-serif",
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f6f1",
};

export const metadata: Metadata = {
  title: {
    default: "Digital GR — જનરલ રજિસ્ટર",
    template: "%s · Digital GR",
  },
  description:
    "The school General Register, digitized. Scan a register page, let the fields fill themselves, and keep every student entry searchable and safe.",
  applicationName: "Digital GR",
  keywords: ["General Register", "જનરલ રજિસ્ટર", "school records", "Gujarat", "OCR"],
  openGraph: {
    title: "Digital GR — જનરલ રજિસ્ટર",
    description:
      "Scan register pages, auto-fill student details, and manage records securely.",
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
      // globals.css sets scroll-behavior: smooth; this tells Next to keep route
      // transitions instant instead of animating the scroll on navigation.
      data-scroll-behavior="smooth"
      className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable} ${notoGujarati.variable} ${notoGujaratiSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AuthProvider>
          <div id="main-content">{children}</div>
        </AuthProvider>

        {/* Paper tooth — kept very light so the ruled grid stays the focus */}
        <div className="grain" aria-hidden="true" />

        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
