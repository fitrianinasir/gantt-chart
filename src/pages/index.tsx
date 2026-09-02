import { useState } from "react"

import { GanttChart, sampleTasks, type GanttTask } from "@/components/gantt"
import { ThemeToggle } from "@/components/theme-toggle"

export default function HomePage() {
  const [tasks, setTasks] = useState<GanttTask[]>(sampleTasks)

  return (
    <div className="flex h-dvh flex-col gap-3 p-3 md:gap-4 md:p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">
            Aurora Release
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan work on the left, stretch the calendar on the right. Use Ctrl
            (or Cmd) + scroll to zoom the timeline.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <GanttChart
        className="min-h-0 flex-1"
        title="Delivery timeline"
        tasks={tasks}
        onTasksChange={setTasks}
      />
    </div>
  )
}
