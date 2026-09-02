export type GanttTask = {
  id: string
  name: string
  team: string
  start: string
  end: string
  /** Hex fill for the family, e.g. `#0284c7`. Subtasks inherit a lighter mix. */
  color: GanttBarColor
  /** Optional notes shown in the task details dialog. */
  description?: string
  children?: GanttTask[]
}

/** Hex color string such as `#0284c7`. */
export type GanttBarColor = string

export type GanttChartProps = {
  tasks: GanttTask[]
  onTasksChange?: (tasks: GanttTask[]) => void
  title?: string
  className?: string
}

/** Root + two nested layers. Depth is 0, 1, 2. */
export const MAX_TASK_DEPTH = 3

export const GANTT_COLOR_CYCLE: GanttBarColor[] = [
  "#0284c7",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#4f46e5",
  "#ea580c",
]

const FALLBACK_HEX = "#64748b"
const LIGHTEN_BY_DEPTH = [0, 0.34, 0.58]

export function normalizeHex(value: string): GanttBarColor {
  const raw = value.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw)
  if (short) {
    const [r, g, b] = short[1]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(raw)
  if (full) return `#${full[1]}`.toLowerCase()
  return FALLBACK_HEX
}

function parseRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex).slice(1)
  const int = Number.parseInt(normalized, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function toHex(r: number, g: number, b: number): GanttBarColor {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`
}

export function mixWithWhite(hex: string, amount: number): GanttBarColor {
  const t = Math.min(1, Math.max(0, amount))
  const [r, g, b] = parseRgb(hex)
  return toHex(
    Math.round(r + (255 - r) * t),
    Math.round(g + (255 - g) * t),
    Math.round(b + (255 - b) * t)
  )
}

export function barFill(hex: string, depth: number): GanttBarColor {
  const amount =
    LIGHTEN_BY_DEPTH[Math.min(Math.max(depth, 0), LIGHTEN_BY_DEPTH.length - 1)]
  return mixWithWhite(hex, amount)
}

export function barTextColor(fill: string): string {
  const [r, g, b] = parseRgb(fill).map((channel) => {
    const s = channel / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.55 ? "#0f172a" : "#ffffff"
}

export function applyFamilyColor(task: GanttTask, color: GanttBarColor): GanttTask {
  const next = normalizeHex(color)
  return {
    ...task,
    color: next,
    children: task.children?.map((child) => applyFamilyColor(child, next)),
  }
}

export function nextRootColor(tasks: GanttTask[]): GanttBarColor {
  const used = new Set(tasks.map((task) => normalizeHex(task.color)))
  return (
    GANTT_COLOR_CYCLE.find((color) => !used.has(color)) ??
    GANTT_COLOR_CYCLE[tasks.length % GANTT_COLOR_CYCLE.length]
  )
}
