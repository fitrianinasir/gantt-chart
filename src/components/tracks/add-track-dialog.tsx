import { useEffect, useState } from "react"

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

export function AddTrackDialog({
  open,
  onOpenChange,
  defaultName,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName?: string
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState(defaultName ?? "")

  useEffect(() => {
    if (open) setName(defaultName ?? "")
  }, [open, defaultName])

  const submit = () => {
    onOpenChange(false)
    onAdd(name)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add track</DialogTitle>
          <DialogDescription>
            Give this track a name. You can rename it later from the card.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-sm font-medium">
          Track name
          <Input
            autoFocus
            value={name}
            placeholder="Track name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submit()
              }
            }}
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit}>
            Add track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
