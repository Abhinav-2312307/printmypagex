import "./globals.css"
import type { Metadata } from "next"
import Script from "next/script"
import { Toaster } from "react-hot-toast"
import { ThemeProvider } from "next-themes"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: "PrintMyPage",
  description: "Campus Printing Marketplace",
  icons: {
    icon: "/printer.svg"
  }
}

const gaMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-GL49SQW1ED"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-dark text-white min-h-screen">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}');
          `}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >

        {children}

        </ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#111827",
              color: "#fff",
              border: "1px solid #374151"
            }
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
