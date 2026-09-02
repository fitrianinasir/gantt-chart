"use client"

import { useEffect } from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useThemeStore } from "@/stores/theme-store"

export function ThemeToggle() {
  const hydrate = useThemeStore((state) => state.hydrate)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle light and dark mode"
      onClick={toggleTheme}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
