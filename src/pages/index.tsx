import { useEffect, useState } from "react";

import { GanttChart, sampleTasks, type GanttTask } from "@/components/gantt";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  const [tasks, setTasks] = useState<GanttTask[]>(sampleTasks);

  useEffect(() => {
    console.log(tasks);
  }, [tasks]);

  return (
    <div className="flex h-dvh flex-col gap-3 p-3 md:gap-4 md:p-4">      
      <GanttChart
        className="min-h-0 flex-1"
        title="TRACK 1"
        tasks={tasks}
        onTasksChange={setTasks}
      />
    </div>
  );
}
