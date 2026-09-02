import { create } from "zustand"

export type ColorScheme = "light" | "dark"

type ThemeState = {
  theme: ColorScheme
  hydrated: boolean
  hydrate: () => void
  toggleTheme: () => void
}

function systemTheme(): ColorScheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(theme: ColorScheme) {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return
    const theme = systemTheme()
    applyTheme(theme)
    set({ theme, hydrated: true })
  },
  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark"
    applyTheme(theme)
    set({ theme, hydrated: true })
  },
}))
