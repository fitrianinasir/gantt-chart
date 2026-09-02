import type { Transition, Variants } from "motion/react"

export const TRACK_CARD_ACCENTS = [
  "#0284c7",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#4f46e5",
  "#ea580c",
] as const

export const trackCardTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 26,
}

export const trackCardVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.18 } },
}

export type TrackCardItem = {
  id: string
  name: string
  href: string
  taskCount: number
  accentColor: string
}

export function trackCardDescription(taskCount: number) {
  if (taskCount === 0) return "Empty chart"
  return `${taskCount} top-level task${taskCount === 1 ? "" : "s"}`
}

export function accentForIndex(index: number) {
  return TRACK_CARD_ACCENTS[index % TRACK_CARD_ACCENTS.length]
}
