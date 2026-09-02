import { useMemo } from "react"
import { motion } from "motion/react"

import {
  accentForIndex,
  TrackCardGrid,
  type TrackCardItem,
} from "@/components/tracks"
import { ThemeToggle } from "@/components/theme-toggle"
import { nextTrackName } from "@/lib/tracks"
import { useTracksStore } from "@/stores/tracks-store"

export default function HomePage() {
  const tracks = useTracksStore((state) => state.tracks)
  const addTrack = useTracksStore((state) => state.addTrack)
  const renameTrack = useTracksStore((state) => state.renameTrack)

  const items = useMemo<TrackCardItem[]>(
    () =>
      tracks.map((track, index) => ({
        id: track.id,
        name: track.name,
        href: `/track/${track.id}`,
        taskCount: track.tasks.length,
        accentColor: accentForIndex(index),
      })),
    [tracks]
  )

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.72_0.12_250/0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.7_0.1_160/0.12),transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.4_0.08_250/0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.35_0.07_160/0.22),transparent_45%)]"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <header className="flex items-start justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            <p className="text-sm font-medium text-muted-foreground">
              Timeline planner
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              Choose a track
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Open a Gantt chart for any track, or add another one to the board.
            </p>
          </motion.div>
          <ThemeToggle />
        </header>

        <TrackCardGrid
          items={items}
          defaultName={nextTrackName(tracks)}
          onAdd={addTrack}
          onRename={renameTrack}
        />
      </div>
    </div>
  )
}
