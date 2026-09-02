import { useEffect, useState, type SyntheticEvent } from "react"
import Link from "next/link"
import { PencilIcon } from "lucide-react"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  trackCardDescription,
  trackCardTransition,
  trackCardVariants,
  type TrackCardItem,
} from "./types"

export function TrackCard({
  item,
  onRename,
}: {
  item: TrackCardItem
  onRename?: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.name)

  useEffect(() => {
    setDraft(item.name)
  }, [item.name])

  const commit = () => {
    const next = draft.trim() || item.name
    setDraft(next)
    setEditing(false)
    if (next !== item.name) onRename?.(next)
  }

  const stopCardClick = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <motion.div layout variants={trackCardVariants}>
      <Link href={item.href} className="block h-full">
        <motion.div
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={editing ? undefined : { scale: 0.98 }}
          transition={trackCardTransition}
          className={cn(
            "group relative flex h-full min-h-40 flex-col justify-end overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-sm"
          )}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundColor: item.accentColor }}
          />
          <span
            aria-hidden
            className="absolute -right-8 -bottom-10 size-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
            style={{ backgroundColor: item.accentColor }}
          />
          {onRename ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Rename track"
              className="absolute top-3 right-3 z-[2] opacity-40 group-hover:opacity-100"
              onClick={(event) => {
                stopCardClick(event)
                setDraft(item.name)
                setEditing(true)
              }}
              onPointerDown={stopCardClick}
            >
              <PencilIcon />
            </Button>
          ) : null}
          <div className="relative z-[1] pr-8">
            {editing ? (
              <input
                autoFocus
                value={draft}
                aria-label="Track name"
                className="w-full rounded-md bg-transparent text-2xl font-semibold tracking-tight outline-none ring-3 ring-ring/50"
                onClick={stopCardClick}
                onPointerDown={stopCardClick}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    commit()
                  }
                  if (event.key === "Escape") {
                    setDraft(item.name)
                    setEditing(false)
                  }
                }}
              />
            ) : (
              <p className="text-2xl font-semibold tracking-tight">{item.name}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {trackCardDescription(item.taskCount)}
            </p>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
