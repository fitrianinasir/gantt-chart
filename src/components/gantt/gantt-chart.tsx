"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isValid,
  isWeekend,
  max as maxDate,
  min as minDate,
  parse,
  parseISO,
  startOfDay,
} from "date-fns"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
  PlusIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  applyFamilyColor,
  barFill,
  barTextColor,
  GANTT_COLOR_CYCLE,
  MAX_TASK_DEPTH,
  nextRootColor,
  normalizeHex,
  type GanttBarColor,
  type GanttChartProps,
  type GanttTask,
} from "./types"
import { ThemeToggle } from "../theme-toggle"

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 64
const MIN_DAY_WIDTH = 10
const MAX_DAY_WIDTH = 80
const MIN_LEFT_WIDTH = 320
const DEFAULT_LEFT_WIDTH = 640
const DEFAULT_DAY_WIDTH = 28
const TASK_COLUMNS = "minmax(168px,1.4fr) 108px 118px 118px 72px 120px"
const LEFT_TABLE_MIN_WIDTH = 168 + 108 + 118 + 118 + 72 + 120
const BAR_MOVE_THRESHOLD_PX = 6

type FlatRow = GanttTask & {
  depth: number
  hasChildren: boolean
}

type DragState =
  | {
      kind: "move" | "resize-start" | "resize-end"
      id: string
      originX: number
      start: string
      end: string
    }
  | null

function parseDate(value: string) {
  const date = parseISO(value)
  return isValid(date) ? date : startOfDay(new Date())
}

function toIso(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function durationDays(start: string, end: string) {
  return Math.max(1, differenceInCalendarDays(parseDate(end), parseDate(start)) + 1)
}

function isStrictIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseISO(value)
  return isValid(date) && format(date, "yyyy-MM-dd") === value
}

function isoToDisplayDate(iso: string) {
  return isStrictIsoDate(iso) ? format(parseISO(iso), "dd/MM/yyyy") : ""
}

function displayDateToIso(value: string) {
  const trimmed = value.trim()
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return null
  const parsed = parse(trimmed, "dd/MM/yyyy", new Date())
  if (!isValid(parsed) || format(parsed, "dd/MM/yyyy") !== trimmed) return null
  return format(parsed, "yyyy-MM-dd")
}

function maskDisplayDate(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function DateInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: string
  onChange: (next: string) => void
  className?: string
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">) {
  const [text, setText] = useState(() => isoToDisplayDate(value))

  useEffect(() => {
    setText(isoToDisplayDate(value))
  }, [value])

  const commitOrRevert = () => {
    const iso = displayDateToIso(text)
    if (iso) onChange(iso)
    else setText(isoToDisplayDate(value))
  }

  return (
    <span className="relative block">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={text}
        className={cn("pr-7", className)}
        onChange={(event) => {
          const next = maskDisplayDate(event.currentTarget.value)
          setText(next)
          const iso = displayDateToIso(next)
          if (iso) onChange(iso)
        }}
        onBlur={commitOrRevert}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }
        }}
        {...props}
      />
      <input
        type="date"
        value={isStrictIsoDate(value) ? value : ""}
        tabIndex={-1}
        aria-label="Open calendar"
        className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 cursor-pointer opacity-0"
        onChange={(event) => {
          const next = event.currentTarget.value
          if (isStrictIsoDate(next)) onChange(next)
        }}
      />
      <CalendarIcon className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </span>
  )
}

function flattenTasks(
  tasks: GanttTask[],
  collapsed: Set<string>,
  depth = 0,
  familyColor?: GanttBarColor
): FlatRow[] {
  const rows: FlatRow[] = []
  for (const task of tasks) {
    const color = depth === 0 ? task.color : (familyColor ?? task.color)
    const hasChildren = Boolean(task.children?.length)
    rows.push({ ...task, color, depth, hasChildren })
    if (hasChildren && !collapsed.has(task.id) && depth < MAX_TASK_DEPTH - 1) {
      rows.push(...flattenTasks(task.children ?? [], collapsed, depth + 1, color))
    }
  }
  return rows
}

function mapTask(tasks: GanttTask[], id: string, mapper: (task: GanttTask) => GanttTask): GanttTask[] {
  return tasks.map((task) => {
    if (task.id === id) return mapper(task)
    if (task.children?.length) {
      return { ...task, children: mapTask(task.children, id, mapper) }
    }
    return task
  })
}

function insertChild(
  tasks: GanttTask[],
  parentId: string,
  child: GanttTask,
  depth = 0
): GanttTask[] {
  return tasks.map((task) => {
    if (task.id === parentId) {
      if (depth >= MAX_TASK_DEPTH - 1) return task
      return { ...task, children: [...(task.children ?? []), child] }
    }
    if (task.children?.length) {
      return { ...task, children: insertChild(task.children, parentId, child, depth + 1) }
    }
    return task
  })
}

function removeTask(tasks: GanttTask[], id: string): GanttTask[] {
  return tasks
    .filter((task) => task.id !== id)
    .map((task) =>
      task.children?.length ? { ...task, children: removeTask(task.children, id) } : task
    )
}

function findTaskDepth(tasks: GanttTask[], id: string, depth = 0): number | null {
  for (const task of tasks) {
    if (task.id === id) return depth
    if (task.children?.length) {
      const nested = findTaskDepth(task.children, id, depth + 1)
      if (nested !== null) return nested
    }
  }
  return null
}

function findTask(tasks: GanttTask[], id: string): GanttTask | undefined {
  for (const task of tasks) {
    if (task.id === id) return task
    if (task.children?.length) {
      const nested = findTask(task.children, id)
      if (nested) return nested
    }
  }
}

function collectDates(tasks: GanttTask[], dates: Date[] = []) {
  for (const task of tasks) {
    dates.push(parseDate(task.start), parseDate(task.end))
    if (task.children?.length) collectDates(task.children, dates)
  }
  return dates
}

function clampDayWidth(value: number) {
  return Math.min(MAX_DAY_WIDTH, Math.max(MIN_DAY_WIDTH, value))
}

function FamilyColorControl({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) {
  const value = normalizeHex(color)
  return (
    <label className="relative size-4 shrink-0 cursor-pointer overflow-hidden rounded-full border border-input shadow-xs">
      <span className="sr-only">Task color</span>
      <span className="block size-full rounded-full" style={{ backgroundColor: value }} />
      <input
        type="color"
        value={value}
        title={value}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => onChange(normalizeHex(event.target.value))}
      />
    </label>
  )
}

export function GanttChart({
  tasks: tasksProp,
  onTasksChange,
  title = "Schedule",
  className,
}: GanttChartProps) {
  const [internalTasks, setInternalTasks] = useState(tasksProp)
  const tasks = onTasksChange ? tasksProp : internalTasks
  const setTasks = useCallback(
    (next: GanttTask[] | ((current: GanttTask[]) => GanttTask[])) => {
      const value = typeof next === "function" ? next(tasks) : next
      if (onTasksChange) onTasksChange(value)
      else setInternalTasks(value)
    },
    [onTasksChange, tasks]
  )

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH)
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftTeam, setDraftTeam] = useState("")
  const [draftStart, setDraftStart] = useState(toIso(new Date()))
  const [draftEnd, setDraftEnd] = useState(toIso(addDays(new Date(), 4)))
  const [draftColor, setDraftColor] = useState(GANTT_COLOR_CYCLE[0])
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [descriptionTaskId, setDescriptionTaskId] = useState<string | null>(null)
  const [draftDescription, setDraftDescription] = useState("")
  const [drag, setDrag] = useState<DragState>(null)

  const chartRef = useRef<HTMLDivElement>(null)
  const leftBodyRef = useRef<HTMLDivElement>(null)
  const leftHeaderRef = useRef<HTMLDivElement>(null)
  const timelineBodyRef = useRef<HTMLDivElement>(null)
  const timelineHeaderRef = useRef<HTMLDivElement>(null)
  const dayWidthRef = useRef(dayWidth)
  const dragRef = useRef<DragState>(null)
  const pendingMoveRef = useRef<{
    id: string
    originX: number
    start: string
    end: string
  } | null>(null)
  const splittingRef = useRef(false)

  useEffect(() => {
    dayWidthRef.current = dayWidth
  }, [dayWidth])

  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  const rows = useMemo(() => flattenTasks(tasks, collapsed), [tasks, collapsed])

  const { timelineStart, days } = useMemo(() => {
    const dates = collectDates(tasks)
    const today = startOfDay(new Date())
    const start = dates.length ? addDays(minDate(dates), -7) : addDays(today, -7)
    const end = dates.length ? addDays(maxDate(dates), 14) : addDays(today, 30)
    return {
      timelineStart: start,
      timelineEnd: end,
      days: eachDayOfInterval({ start, end }),
    }
  }, [tasks])

  const timelineWidth = days.length * dayWidth
  const today = startOfDay(new Date())
  const todayIndex = days.findIndex((day) => isSameDay(day, today))

  const months = useMemo(() => {
    const groups: { key: string; label: string; count: number }[] = []
    for (const day of days) {
      const key = format(day, "yyyy-MM")
      const last = groups[groups.length - 1]
      if (last?.key === key) last.count += 1
      else groups.push({ key, label: format(day, "MMMM yyyy"), count: 1 })
    }
    return groups
  }, [days])

  const updateTask = useCallback(
    (id: string, patch: Partial<GanttTask>) => {
      setTasks((current) =>
        mapTask(current, id, (task) => {
          const next = { ...task, ...patch }
          const colored = patch.color ? applyFamilyColor(next, patch.color) : next
          if (parseDate(colored.end) < parseDate(colored.start)) {
            colored.end = colored.start
          }
          return colored
        })
      )
    },
    [setTasks]
  )

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openNewTask = (parentId: string | null) => {
    if (parentId !== null) {
      const depth = findTaskDepth(tasks, parentId)
      if (depth === null || depth >= MAX_TASK_DEPTH - 1) return
    }
    const parent = parentId ? findTask(tasks, parentId) : undefined
    setParentIdForNew(parentId)
    setDraftName("")
    setDraftTeam(parent?.team ?? "")
    setDraftStart(parent?.start ?? toIso(today))
    setDraftEnd(parent?.end ?? toIso(addDays(today, 4)))
    setDraftColor(parent?.color ?? nextRootColor(tasks))
    setDialogOpen(true)
  }

  const submitNewTask = () => {
    const name = draftName.trim() || "Untitled task"
    const team = draftTeam.trim() || "Unassigned"
    const start = draftStart || toIso(today)
    const end = parseDate(draftEnd) < parseDate(start) ? start : draftEnd
    const parent = parentIdForNew ? findTask(tasks, parentIdForNew) : undefined
    const task: GanttTask = {
      id: crypto.randomUUID(),
      name,
      team,
      start,
      end,
      color: parent?.color ?? normalizeHex(draftColor),
    }
    if (parentIdForNew) {
      setTasks((current) => insertChild(current, parentIdForNew, task))
      setCollapsed((current) => {
        const next = new Set(current)
        next.delete(parentIdForNew)
        return next
      })
    } else {
      setTasks((current) => [...current, task])
    }
    setDialogOpen(false)
  }

  const openDescription = (id: string) => {
    const task = findTask(tasks, id)
    if (!task) return
    setDescriptionTaskId(id)
    setDraftDescription(task.description ?? "")
    setDescriptionOpen(true)
  }

  const saveDescription = () => {
    if (!descriptionTaskId) return
    updateTask(descriptionTaskId, { description: draftDescription.trim() })
    setDescriptionOpen(false)
  }

  const descriptionTask = descriptionTaskId
    ? findTask(tasks, descriptionTaskId)
    : undefined

  const syncVertical = (source: "left" | "right") => {
    const left = leftBodyRef.current
    const right = timelineBodyRef.current
    if (!left || !right) return
    if (source === "left") right.scrollTop = left.scrollTop
    else left.scrollTop = right.scrollTop
  }

  const syncLeftHeader = () => {
    if (leftHeaderRef.current && leftBodyRef.current) {
      leftHeaderRef.current.scrollLeft = leftBodyRef.current.scrollLeft
    }
  }

  const syncHeader = () => {
    if (timelineHeaderRef.current && timelineBodyRef.current) {
      timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft
    }
  }

  const scrollTodayIntoView = () => {
    const el = timelineBodyRef.current
    if (!el || todayIndex < 0) return
    el.scrollLeft = todayIndex * dayWidth - el.clientWidth / 2 + dayWidth / 2
    syncHeader()
  }

  const zoomBy = (factor: number, originX?: number) => {
    const el = timelineBodyRef.current
    if (!el) return
    const current = dayWidthRef.current
    const next = clampDayWidth(current * factor)
    if (next === current) return
    const cursor = originX ?? el.clientWidth / 2
    const dateOffset = (el.scrollLeft + cursor) / current
    dayWidthRef.current = next
    setDayWidth(next)
    requestAnimationFrame(() => {
      el.scrollLeft = dateOffset * next - cursor
      syncHeader()
    })
  }

  useEffect(() => {
    const root = chartRef.current
    if (!root) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const el = timelineBodyRef.current
      if (!el) return
      const current = dayWidthRef.current
      const next = clampDayWidth(current * (event.deltaY < 0 ? 1.12 : 1 / 1.12))
      if (next === current) return
      const originX = event.clientX - el.getBoundingClientRect().left
      const dateOffset = (el.scrollLeft + originX) / current
      dayWidthRef.current = next
      setDayWidth(next)
      requestAnimationFrame(() => {
        el.scrollLeft = dateOffset * next - originX
        if (timelineHeaderRef.current) {
          timelineHeaderRef.current.scrollLeft = el.scrollLeft
        }
      })
    }

    root.addEventListener("wheel", onWheel, { passive: false })
    return () => root.removeEventListener("wheel", onWheel)
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (splittingRef.current) {
        const root = chartRef.current
        if (!root) return
        const left = event.clientX - root.getBoundingClientRect().left
        const max = root.clientWidth * 0.72
        setLeftWidth(Math.min(max, Math.max(MIN_LEFT_WIDTH, left)))
        return
      }

      const pending = pendingMoveRef.current
      if (pending && !dragRef.current) {
        if (Math.abs(event.clientX - pending.originX) < BAR_MOVE_THRESHOLD_PX) return
        pendingMoveRef.current = null
        event.preventDefault()
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        document.body.style.cursor = "grabbing"
        const nextDrag: DragState = {
          kind: "move",
          id: pending.id,
          originX: pending.originX,
          start: pending.start,
          end: pending.end,
        }
        dragRef.current = nextDrag
        setDrag(nextDrag)
      }

      const current = dragRef.current
      const el = timelineBodyRef.current
      if (!current || !el) return
      const deltaDays = Math.round((event.clientX - current.originX) / dayWidthRef.current)
      const start = parseDate(current.start)
      const end = parseDate(current.end)
      const span = differenceInCalendarDays(end, start)

      if (current.kind === "move") {
        const nextStart = addDays(start, deltaDays)
        updateTask(current.id, { start: toIso(nextStart), end: toIso(addDays(nextStart, span)) })
      } else if (current.kind === "resize-start") {
        const nextStart = addDays(start, deltaDays)
        if (nextStart <= end) updateTask(current.id, { start: toIso(nextStart) })
      } else {
        const nextEnd = addDays(end, deltaDays)
        if (nextEnd >= start) updateTask(current.id, { end: toIso(nextEnd) })
      }
    }

    const onUp = () => {
      splittingRef.current = false
      pendingMoveRef.current = null
      setDrag(null)
      document.body.style.cursor = ""
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [updateTask])

  useEffect(() => {
    const el = timelineBodyRef.current
    if (!el || todayIndex < 0) return
    el.scrollLeft = Math.max(0, todayIndex * DEFAULT_DAY_WIDTH - 240)
    syncHeader()
    // Center near today on first mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginBarDrag = (
    event: React.PointerEvent,
    row: FlatRow,
    kind: "move" | "resize-start" | "resize-end"
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()

    if (kind === "move") {
      const target = event.target as HTMLElement
      const title = target.closest("input")
      if (title && document.activeElement === title) return
      if (!title) event.preventDefault()
      pendingMoveRef.current = {
        id: row.id,
        originX: event.clientX,
        start: row.start,
        end: row.end,
      }
      return
    }

    event.preventDefault()
    pendingMoveRef.current = null
    setDrag({
      kind,
      id: row.id,
      originX: event.clientX,
      start: row.start,
      end: row.end,
    })
  }

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("[data-gantt-bar]")) return
    const el = timelineBodyRef.current
    if (!el) return
    const originX = event.clientX
    const originScroll = el.scrollLeft
    const onMove = (moveEvent: PointerEvent) => {
      el.scrollLeft = originScroll - (moveEvent.clientX - originX)
      syncHeader()
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const zoomPercent = Math.round(
    ((dayWidth - MIN_DAY_WIDTH) / (MAX_DAY_WIDTH - MIN_DAY_WIDTH)) * 100
  )

  return (
    <div
      ref={chartRef}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <p className="truncate text-sm font-medium">{title}</p>
          <Badge variant="secondary">{rows.length} rows</Badge>
        </div>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Ctrl + scroll to zoom · Drag empty calendar to pan · Drag bars to reschedule
        </p>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom out"
                  onClick={() => zoomBy(1 / 1.2)}
                />
              }
            >
              <ZoomOutIcon />
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <input
            type="range"
            min={MIN_DAY_WIDTH}
            max={MAX_DAY_WIDTH}
            value={dayWidth}
            aria-label="Timeline zoom"
            className="h-1 w-24 cursor-pointer accent-primary"
            onChange={(event) => {
              const el = timelineBodyRef.current
              const current = dayWidthRef.current
              const next = Number(event.target.value)
              if (!el) {
                dayWidthRef.current = next
                setDayWidth(next)
                return
              }
              const cursor = el.clientWidth / 2
              const dateOffset = (el.scrollLeft + cursor) / current
              dayWidthRef.current = next
              setDayWidth(next)
              requestAnimationFrame(() => {
                el.scrollLeft = dateOffset * next - cursor
                syncHeader()
              })
            }}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom in"
                  onClick={() => zoomBy(1.2)}
                />
              }
            >
              <ZoomInIcon />
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          <Badge variant="outline" className="tabular-nums">
            {zoomPercent}%
          </Badge>
          <Button variant="outline" size="sm" onClick={scrollTodayIntoView}>
            Today
          </Button>
          <Button size="sm" onClick={() => openNewTask(null)}>
            <PlusIcon data-icon="inline-start" />
            Add task
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className="flex min-h-0 shrink-0 flex-col border-r"
          style={{ width: leftWidth, maxWidth: "72%" }}
        >
          <div
            ref={leftHeaderRef}
            className="shrink-0 overflow-x-hidden overflow-y-hidden border-b bg-muted/40"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className="grid h-full items-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              style={{
                minWidth: LEFT_TABLE_MIN_WIDTH,
                gridTemplateColumns: TASK_COLUMNS,
              }}
            >
              <span className="px-3">Task name</span>
              <span className="px-1">Team</span>
              <span className="px-1">Start date</span>
              <span className="px-1">End date</span>
              <span className="px-1">Duration</span>
              <span className="sr-only">Row actions</span>
            </div>
          </div>
          <div
            ref={leftBodyRef}
            className="min-h-0 flex-1 overflow-auto overscroll-none"
            onScroll={() => {
              syncLeftHeader()
              syncVertical("left")
            }}
          >
            {rows.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm font-medium">No tasks yet</p>
                <p className="text-xs text-muted-foreground">
                  Add a task to start planning the timeline.
                </p>
                <Button size="sm" onClick={() => openNewTask(null)}>
                  <PlusIcon data-icon="inline-start" />
                  Add task
                </Button>
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center border-b hover:bg-muted/40"
                  style={{
                    height: ROW_HEIGHT,
                    minWidth: LEFT_TABLE_MIN_WIDTH,
                    gridTemplateColumns: TASK_COLUMNS,
                  }}
                >
                  <div
                    className="flex min-w-0 items-center gap-1 px-1"
                    style={{ paddingLeft: 6 + row.depth * 16 }}
                  >
                    {row.hasChildren ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={collapsed.has(row.id) ? "Expand" : "Collapse"}
                        onClick={() => toggleCollapsed(row.id)}
                      >
                        {collapsed.has(row.id) ? <ChevronRightIcon /> : <ChevronDownIcon />}
                      </Button>
                    ) : (
                      <span className="size-6 shrink-0" />
                    )}
                    <Input
                      value={row.name}
                      aria-label="Task name"
                      className="h-7 border-transparent bg-transparent px-1.5 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
                      onChange={(event) => updateTask(row.id, { name: event.target.value })}
                    />
                  </div>
                  <div className="px-1">
                    <Input
                      value={row.team}
                      aria-label="Team"
                      className="h-7 border-transparent bg-transparent px-1 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
                      onChange={(event) => updateTask(row.id, { team: event.target.value })}
                    />
                  </div>
                  <div className="px-1">
                    <DateInput
                      value={row.start}
                      aria-label="Start date"
                      className="h-7 px-1.5 text-xs"
                      onChange={(start) => updateTask(row.id, { start })}
                    />
                  </div>
                  <div className="px-1">
                    <DateInput
                      value={row.end}
                      aria-label="End date"
                      className="h-7 px-1.5 text-xs"
                      onChange={(end) => updateTask(row.id, { end })}
                    />
                  </div>
                  <div className="px-1">
                    <Input
                      type="number"
                      min={1}
                      value={durationDays(row.start, row.end)}
                      aria-label="Duration in days"
                      className="h-7 px-1.5 text-xs tabular-nums"
                      onChange={(event) => {
                        const daysCount = Math.max(1, Number(event.target.value) || 1)
                        updateTask(row.id, {
                          end: toIso(addDays(parseDate(row.start), daysCount - 1)),
                        })
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-0.5 px-0.5">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className={
                              row.description
                                ? "text-primary"
                                : "text-muted-foreground"
                            }
                            aria-label="Task description"
                            onClick={() => openDescription(row.id)}
                          />
                        }
                      >
                        <InfoIcon />
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.description ? "Edit description" : "Add description"}
                      </TooltipContent>
                    </Tooltip>
                    {row.depth < MAX_TASK_DEPTH - 1 ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Add subtask"
                              onClick={() => openNewTask(row.id)}
                            />
                          }
                        >
                          <PlusIcon />
                        </TooltipTrigger>
                        <TooltipContent>Add subtask</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Maximum of 3 levels"
                              disabled
                            />
                          }
                        >
                          <PlusIcon />
                        </TooltipTrigger>
                        <TooltipContent>Maximum of 3 levels</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete task"
                            onClick={() => setTasks((current) => removeTask(current, row.id))}
                          />
                        }
                      >
                        <Trash2Icon />
                      </TooltipTrigger>
                      <TooltipContent>Delete task</TooltipContent>
                    </Tooltip>
                    {row.depth === 0 ? (
                      <FamilyColorControl
                        color={row.color}
                        onChange={(color) => updateTask(row.id, { color })}
                      />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Resize task list"
          className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary"
          onPointerDown={() => {
            splittingRef.current = true
            document.body.style.cursor = "col-resize"
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={timelineHeaderRef}
            className="overflow-hidden border-b bg-muted/40"
            style={{ height: HEADER_HEIGHT }}
          >
            <div style={{ width: timelineWidth }}>
              <div className="flex h-8 border-b text-xs font-medium">
                {months.map((month) => (
                  <div
                    key={month.key}
                    className="flex items-center overflow-hidden border-r px-2 text-muted-foreground"
                    style={{ width: month.count * dayWidth }}
                  >
                    <span className="truncate">{month.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex h-8">
                {days.map((day) => {
                  const isToday = isSameDay(day, today)
                  const showLabel =
                    dayWidth >= 26 || day.getDate() === 1 || day.getDay() === 1
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex flex-col items-center justify-center border-r text-[10px] leading-none",
                        isWeekend(day) && "bg-muted/70",
                        isToday && "bg-primary/15 text-primary"
                      )}
                      style={{ width: dayWidth }}
                    >
                      {dayWidth >= 36 && (
                        <span className="text-muted-foreground uppercase">
                          {format(day, "EEEEE")}
                        </span>
                      )}
                      {showLabel && (
                        <span className="tabular-nums">{format(day, "d")}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div
            ref={timelineBodyRef}
            className="relative min-h-0 flex-1 overflow-auto overscroll-none"
            onScroll={() => {
              syncVertical("right")
              syncHeader()
            }}
            onPointerDown={beginPan}
          >
            <div className="relative" style={{ width: timelineWidth, height: Math.max(rows.length, 1) * ROW_HEIGHT }}>
              <div className="pointer-events-none absolute inset-0 flex">
                {days.map((day) => (
                  <div
                    key={`grid-${day.toISOString()}`}
                    className={cn(
                      "h-full border-r",
                      isWeekend(day) && "bg-muted/40",
                      isSameDay(day, today) && "bg-primary/10",
                      day.getDay() === 1 && "border-r-border"
                    )}
                    style={{ width: dayWidth }}
                  />
                ))}
              </div>
              {todayIndex >= 0 && (
                <div
                  className="pointer-events-none absolute top-0 z-10 h-full w-px bg-primary"
                  style={{ left: todayIndex * dayWidth + dayWidth / 2 }}
                />
              )}
              {rows.map((row, index) => {
                const offset = differenceInCalendarDays(parseDate(row.start), timelineStart)
                const span = durationDays(row.start, row.end)
                const left = offset * dayWidth
                const width = Math.max(span * dayWidth - 4, 8)
                const fill = barFill(row.color, row.depth)
                const ink = barTextColor(fill)
                return (
                  <div
                    key={`bar-${row.id}`}
                    className="absolute right-0 left-0 border-b"
                    style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div
                            data-gantt-bar=""
                            className="absolute top-2.5 flex h-7 cursor-grab items-center rounded-md px-1.5 text-xs font-medium shadow-sm hover:brightness-90 active:cursor-grabbing"
                            style={{
                              left: left + 2,
                              width,
                              backgroundColor: fill,
                              color: ink,
                            }}
                            onPointerDown={(event) => beginBarDrag(event, row, "move")}
                          />
                        }
                      >
                        <span
                          className="absolute top-0 left-0 z-10 h-full w-1.5 cursor-ew-resize rounded-l-md"
                          onPointerDown={(event) => beginBarDrag(event, row, "resize-start")}
                        />
                        <input
                          value={row.name}
                          aria-label="Task name on timeline"
                          className="relative z-[1] h-full min-w-0 flex-1 cursor-grab bg-transparent px-1 text-xs font-medium outline-none select-text placeholder:opacity-60 focus:cursor-text"
                          style={{ color: ink }}
                          onChange={(event) =>
                            updateTask(row.id, { name: event.target.value })
                          }
                        />
                        <span
                          className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-ew-resize rounded-r-md"
                          onPointerDown={(event) => beginBarDrag(event, row, "resize-end")}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.name} · {row.team} · {format(parseDate(row.start), "MMM d")} –{" "}
                        {format(parseDate(row.end), "MMM d")} ({span}d)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{parentIdForNew ? "Add subtask" : "Add task"}</DialogTitle>
            <DialogDescription>
              {parentIdForNew
                ? "This row will nest under the selected parent task."
                : "Creates a top-level row on the timeline."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Task name
              <Input
                value={draftName}
                placeholder="Write a clear task name"
                onChange={(event) => setDraftName(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Team
              <Input
                value={draftTeam}
                placeholder="Team name"
                onChange={(event) => setDraftTeam(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Start date
                <DateInput
                  value={draftStart}
                  onChange={setDraftStart}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                End date
                <DateInput
                  value={draftEnd}
                  onChange={setDraftEnd}
                />
              </label>
            </div>
            {!parentIdForNew && (
              <div className="grid gap-1.5 text-sm font-medium">
                Bar color
                <FamilyColorControl color={draftColor} onChange={setDraftColor} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNewTask}>Save task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Task description</DialogTitle>
            <DialogDescription>
              {descriptionTask
                ? `Notes for ${descriptionTask.name}.`
                : "Add extra detail for this task."}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm font-medium">
            Description
            <textarea
              value={draftDescription}
              rows={6}
              placeholder="Write additional context, links, or notes"
              className="min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescriptionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDescription}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
