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

export const GANTT_BAR_COLORS: Record<GanttBarColor, string> = {
  sky: "bg-sky-500 hover:bg-sky-600",
  violet: "bg-violet-500 hover:bg-violet-600",
  emerald: "bg-emerald-500 hover:bg-emerald-600",
  amber: "bg-amber-500 hover:bg-amber-600",
  rose: "bg-rose-500 hover:bg-rose-600",
  cyan: "bg-cyan-500 hover:bg-cyan-600",
  indigo: "bg-indigo-500 hover:bg-indigo-600",
  orange: "bg-orange-500 hover:bg-orange-600",
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
