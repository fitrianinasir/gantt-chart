# Gantt Chart

A Next.js (Pages Router) timeline planner with a task table on the left and a zoomable calendar on the right. Built with Tailwind CSS and shadcn/ui, including light and dark mode.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What you can do

- Edit task name, PIC, start date, end date, and duration inline
- Add a top-level task or nest a subtask with the **+** control
- Collapse parent rows, resize the task list, and delete tasks
- Drag bars to move dates, drag bar edges to change duration
- Drag empty calendar space to pan
- **Ctrl + scroll** (Cmd + scroll on macOS) to zoom the calendar
- Switch light / dark mode from the header

## Copy this into another app

The feature lives in `src/components/gantt/`. Copy that folder, then render:

```tsx
import { GanttChart, type GanttTask } from "@/components/gantt"

<GanttChart tasks={tasks} onTasksChange={setTasks} title="Delivery timeline" />
```

It expects these shadcn/ui primitives: `button`, `input`, `dialog`, `tooltip`, `badge`, and `avatar`.
