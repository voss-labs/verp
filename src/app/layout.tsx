import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const TOAST_CLEARANCE_FOR_BUG_BUTTON = { bottom: "5.5rem" }

export const metadata: Metadata = {
  title: "VERP - Vidyalankar ERP",
  description: "Open-source ERP for Vidyalankar Institute of Technology",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background min-h-dvh font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            {children}
            <Toaster
              offset={TOAST_CLEARANCE_FOR_BUG_BUTTON}
              mobileOffset={TOAST_CLEARANCE_FOR_BUG_BUTTON}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
