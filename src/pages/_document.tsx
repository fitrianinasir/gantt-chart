import { Head, Html, Main, NextScript } from "next/document"

export default function Document() {
  return (
    <Html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <Head />
      <body className="min-h-full bg-background font-sans text-foreground">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
