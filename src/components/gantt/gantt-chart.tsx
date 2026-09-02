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
  parseISO,
  startOfDay,
} from "date-fns"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  barColorClass,
  MAX_TASK_DEPTH,
  nextRootColor,
  type GanttBarColor,
  type GanttChartProps,
  type GanttTask,
} from "./types"

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 64
const MIN_DAY_WIDTH = 10
const MAX_DAY_WIDTH = 80
const MIN_LEFT_WIDTH = 320
const DEFAULT_LEFT_WIDTH = 640
const DEFAULT_DAY_WIDTH = 28

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
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
  const [draftPic, setDraftPic] = useState("")
  const [draftStart, setDraftStart] = useState(toIso(new Date()))
  const [draftEnd, setDraftEnd] = useState(toIso(addDays(new Date(), 4)))
  const [drag, setDrag] = useState<DragState>(null)

  const chartRef = useRef<HTMLDivElement>(null)
  const leftBodyRef = useRef<HTMLDivElement>(null)
  const timelineBodyRef = useRef<HTMLDivElement>(null)
  const timelineHeaderRef = useRef<HTMLDivElement>(null)
  const dayWidthRef = useRef(dayWidth)
  const dragRef = useRef<DragState>(null)
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
          if (parseDate(next.end) < parseDate(next.start)) {
            next.end = next.start
          }
          return next
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
    setDraftPic(parent?.pic ?? "")
    setDraftStart(parent?.start ?? toIso(today))
    setDraftEnd(parent?.end ?? toIso(addDays(today, 4)))
    setDialogOpen(true)
  }

  const submitNewTask = () => {
    const name = draftName.trim() || "Untitled task"
    const pic = draftPic.trim() || "Unassigned"
    const start = draftStart || toIso(today)
    const end = parseDate(draftEnd) < parseDate(start) ? start : draftEnd
    const parent = parentIdForNew ? findTask(tasks, parentIdForNew) : undefined
    const task: GanttTask = {
      id: crypto.randomUUID(),
      name,
      pic,
      start,
      end,
      color: parent?.color ?? nextRootColor(tasks),
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

  const syncVertical = (source: "left" | "right") => {
    const left = leftBodyRef.current
    const right = timelineBodyRef.current
    if (!left || !right) return
    if (source === "left") right.scrollTop = left.scrollTop
    else left.scrollTop = right.scrollTop
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
    event.stopPropagation()
    event.preventDefault()
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
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className="flex min-h-0 shrink-0 flex-col border-r"
          style={{ width: leftWidth, maxWidth: "72%" }}
        >
          <div
            className="grid shrink-0 items-center border-b bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
            style={{
              height: HEADER_HEIGHT,
              gridTemplateColumns: "minmax(160px,1.4fr) 108px 118px 118px 72px 40px",
            }}
          >
            <span className="px-3">Task name</span>
            <span className="px-1">PIC</span>
            <span className="px-1">Start date</span>
            <span className="px-1">End date</span>
            <span className="px-1">Duration</span>
            <span className="sr-only">Add subtask</span>
          </div>
          <div
            ref={leftBodyRef}
            className="min-h-0 flex-1 overflow-auto overscroll-none"
            onScroll={() => syncVertical("left")}
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
                    gridTemplateColumns: "minmax(160px,1.4fr) 108px 118px 118px 72px 40px",
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
                  </div>
                  <div className="flex min-w-0 items-center gap-1 px-1">
                    <Avatar size="sm" className="size-5">
                      <AvatarFallback className="text-[9px]">
                        {initials(row.pic)}
                      </AvatarFallback>
                    </Avatar>
                    <Input
                      value={row.pic}
                      aria-label="PIC"
                      className="h-7 border-transparent bg-transparent px-1 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
                      onChange={(event) => updateTask(row.id, { pic: event.target.value })}
                    />
                  </div>
                  <div className="px-1">
                    <Input
                      type="date"
                      value={row.start}
                      aria-label="Start date"
                      className="h-7 px-1.5 text-xs"
                      onChange={(event) => updateTask(row.id, { start: event.target.value })}
                    />
                  </div>
                  <div className="px-1">
                    <Input
                      type="date"
                      value={row.end}
                      aria-label="End date"
                      className="h-7 px-1.5 text-xs"
                      onChange={(event) => updateTask(row.id, { end: event.target.value })}
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
                  <div className="flex justify-center">
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
                            className={cn(
                              "absolute top-2.5 flex h-7 cursor-grab items-center rounded-md px-2 text-xs font-medium shadow-sm active:cursor-grabbing",
                              barColorClass(row.color, row.depth)
                            )}
                            style={{ left: left + 2, width }}
                            onPointerDown={(event) => beginBarDrag(event, row, "move")}
                          />
                        }
                      >
                        <span
                          className="absolute top-0 h-full w-1.5 cursor-ew-resize rounded-l-md"
                          onPointerDown={(event) => beginBarDrag(event, row, "resize-start")}
                        />
                        <span className="truncate">{width > 72 ? row.name : ""}</span>
                        <span
                          className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize rounded-r-md"
                          onPointerDown={(event) => beginBarDrag(event, row, "resize-end")}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.name} · {row.pic} · {format(parseDate(row.start), "MMM d")} –{" "}
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
              PIC
              <Input
                value={draftPic}
                placeholder="Owner name"
                onChange={(event) => setDraftPic(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Start date
                <Input
                  type="date"
                  value={draftStart}
                  onChange={(event) => setDraftStart(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                End date
                <Input
                  type="date"
                  value={draftEnd}
                  onChange={(event) => setDraftEnd(event.target.value)}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNewTask}>Save task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
