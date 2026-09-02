import { PlusIcon } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

import { trackCardTransition, trackCardVariants } from "./types"

export function AddTrackCard({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.button
      type="button"
      layout
      variants={trackCardVariants}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={trackCardTransition}
      onClick={onAdd}
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/40 p-5 text-muted-foreground shadow-sm",
        "hover:border-foreground/30 hover:bg-card hover:text-foreground"
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-dashed">
        <PlusIcon className="size-5" />
      </span>
      <span className="text-lg font-medium">+ Add New</span>
    </motion.button>
  )
}
