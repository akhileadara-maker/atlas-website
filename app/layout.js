import { ClerkProvider } from "@clerk/nextjs";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Atlas — Property operations, automated",
  description:
    "Atlas is the AI-powered platform that answers your tenants, tracks your leases, and handles maintenance — automatically, 24/7. One platform. Every property. Every tenant. Every lease.",
  metadataBase: new URL("https://atlas.com"),
  openGraph: {
    title: "Atlas — Property operations, automated",
    description:
      "The AI-powered platform for landlords, property owners & property managers. Answers tenants, tracks leases, handles maintenance — 24/7.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
        <body className="min-h-screen antialiased">
          <Navbar />
          <main>{children}</main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
