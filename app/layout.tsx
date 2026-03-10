import "./globals.css"
import type { Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { ThemeProvider } from "next-themes"

export const metadata: Metadata = {
  title: "PrintMyPage",
  description: "Campus Printing Marketplace",
  icons: {
    icon: "/printer.svg"
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-dark text-white min-h-screen">
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
        
      </body>
    </html>
  )
}