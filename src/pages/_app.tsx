import type { AppProps } from "next/app"
import Head from "next/head"
import { Geist, Geist_Mono } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

import "@/styles/globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Gantt Chart</title>
        <meta
          name="description"
          content="A reusable timeline planner with a task list and zoomable calendar."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--font-geist-sans:${geistSans.style.fontFamily};--font-geist-mono:${geistMono.style.fontFamily}}`,
          }}
        />
      </Head>
      <div className={`${geistSans.variable} ${geistMono.variable} min-h-full`}>
        <ThemeProvider>
          <TooltipProvider delay={250}>
            <Component {...pageProps} />
          </TooltipProvider>
        </ThemeProvider>
      </div>
    </>
  )
}
