import Link from "next/link"
import { useRouter } from "next/router"
import { ArrowLeftIcon } from "lucide-react"

import { GanttChart } from "@/components/gantt"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTracksStore } from "@/stores/tracks-store"

export default function TrackPage() {
  const router = useRouter()
  const id = typeof router.query.id === "string" ? router.query.id : ""
  const track = useTracksStore((state) =>
    state.tracks.find((item) => item.id === id)
  )
  const updateTrackTasks = useTracksStore((state) => state.updateTrackTasks)

  if (!router.isReady) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading track…
      </div>
    )
  }

  if (!track) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-medium">Track not found</p>
        <p className="text-sm text-muted-foreground">
          This track is not in the current list.
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to tracks
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col gap-3 p-3 md:gap-4 md:p-4">
      <GanttChart
        className="min-h-0 flex-1"
        title={track.name.toUpperCase()}
        tasks={track.tasks}
        onTasksChange={(tasks) => updateTrackTasks(track.id, tasks)}
        leading={
          <Link
            href="/"
            aria-label="Back to tracks"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <ArrowLeftIcon />
          </Link>
        }
      />
    </div>
  )
}
