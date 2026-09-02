import { create } from "zustand"

import type { GanttTask } from "@/components/gantt"
import { defaultTracks, nextTrackName, type GanttTrack } from "@/lib/tracks"

type TracksState = {
  tracks: GanttTrack[]
  addTrack: (name?: string) => GanttTrack
  renameTrack: (id: string, name: string) => void
  updateTrackTasks: (id: string, tasks: GanttTask[]) => void
}

export const useTracksStore = create<TracksState>((set, get) => ({
  tracks: defaultTracks(),
  addTrack: (name) => {
    const track: GanttTrack = {
      id: crypto.randomUUID(),
      name: name?.trim() || nextTrackName(get().tracks),
      tasks: [],
    }
    set({ tracks: [...get().tracks, track] })
    return track
  },
  renameTrack: (id, name) => {
    const next = name.trim()
    if (!next) return
    set({
      tracks: get().tracks.map((track) =>
        track.id === id ? { ...track, name: next } : track
      ),
    })
  },
  updateTrackTasks: (id, tasks) => {
    set({
      tracks: get().tracks.map((track) =>
        track.id === id ? { ...track, tasks } : track
      ),
    })
  },
}))
