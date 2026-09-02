import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { AddTrackCard } from "./add-track-card"
import { AddTrackDialog } from "./add-track-dialog"
import { TrackCard } from "./track-card"
import { type TrackCardItem } from "./types"

export function TrackCardGrid({
  items,
  defaultName,
  onAdd,
  onRename,
}: {
  items: TrackCardItem[]
  defaultName?: string
  onAdd?: (name: string) => void
  onRename?: (id: string, name: string) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
        }}
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <TrackCard
              key={item.id}
              item={item}
              onRename={
                onRename ? (name) => onRename(item.id, name) : undefined
              }
            />
          ))}
          {onAdd ? (
            <AddTrackCard key="add-new" onAdd={() => setDialogOpen(true)} />
          ) : null}
        </AnimatePresence>
      </motion.div>
      {onAdd ? (
        <AddTrackDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultName={defaultName}
          onAdd={onAdd}
        />
      ) : null}
    </>
  )
}
