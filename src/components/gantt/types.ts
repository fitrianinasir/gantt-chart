export type GanttTask = {
  id: string
  name: string
  pic: string
  start: string
  end: string
  color: GanttBarColor
  children?: GanttTask[]
}

export type GanttBarColor =
  | "sky"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "indigo"
  | "orange"

export type GanttChartProps = {
  tasks: GanttTask[]
  onTasksChange?: (tasks: GanttTask[]) => void
  title?: string
  className?: string
}

/** Root + two nested layers. Depth is 0, 1, 2. */
export const MAX_TASK_DEPTH = 3

export const GANTT_BAR_COLORS: Record<GanttBarColor, [string, string, string]> = {
  sky: [
    "bg-sky-600 hover:bg-sky-700 text-white",
    "bg-sky-400 hover:bg-sky-500 text-white",
    "bg-sky-200 hover:bg-sky-300 text-sky-950",
  ],
  violet: [
    "bg-violet-600 hover:bg-violet-700 text-white",
    "bg-violet-400 hover:bg-violet-500 text-white",
    "bg-violet-200 hover:bg-violet-300 text-violet-950",
  ],
  emerald: [
    "bg-emerald-600 hover:bg-emerald-700 text-white",
    "bg-emerald-400 hover:bg-emerald-500 text-white",
    "bg-emerald-200 hover:bg-emerald-300 text-emerald-950",
  ],
  amber: [
    "bg-amber-600 hover:bg-amber-700 text-white",
    "bg-amber-400 hover:bg-amber-500 text-white",
    "bg-amber-200 hover:bg-amber-300 text-amber-950",
  ],
  rose: [
    "bg-rose-600 hover:bg-rose-700 text-white",
    "bg-rose-400 hover:bg-rose-500 text-white",
    "bg-rose-200 hover:bg-rose-300 text-rose-950",
  ],
  cyan: [
    "bg-cyan-600 hover:bg-cyan-700 text-white",
    "bg-cyan-400 hover:bg-cyan-500 text-white",
    "bg-cyan-200 hover:bg-cyan-300 text-cyan-950",
  ],
  indigo: [
    "bg-indigo-600 hover:bg-indigo-700 text-white",
    "bg-indigo-400 hover:bg-indigo-500 text-white",
    "bg-indigo-200 hover:bg-indigo-300 text-indigo-950",
  ],
  orange: [
    "bg-orange-600 hover:bg-orange-700 text-white",
    "bg-orange-400 hover:bg-orange-500 text-white",
    "bg-orange-200 hover:bg-orange-300 text-orange-950",
  ],
}

export const GANTT_COLOR_CYCLE: GanttBarColor[] = [
  "sky",
  "violet",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "indigo",
  "orange",
]

export function barColorClass(color: GanttBarColor, depth: number) {
  const shades = GANTT_BAR_COLORS[color]
  return shades[Math.min(Math.max(depth, 0), shades.length - 1)]
}

export function nextRootColor(tasks: GanttTask[]): GanttBarColor {
  const used = new Set(tasks.map((task) => task.color))
  return (
    GANTT_COLOR_CYCLE.find((color) => !used.has(color)) ??
    GANTT_COLOR_CYCLE[tasks.length % GANTT_COLOR_CYCLE.length]
  )
}
