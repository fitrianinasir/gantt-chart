import { sampleTasks, type GanttTask } from "@/components/gantt"

export type GanttTrack = {
  id: string
  name: string
  tasks: GanttTask[]
}

export const INITIAL_TRACK_COUNT = 9

function cloneTasks(tasks: GanttTask[]): GanttTask[] {
  return JSON.parse(JSON.stringify(tasks)) as GanttTask[]
}

export function defaultTracks(): GanttTrack[] {
  return Array.from({ length: INITIAL_TRACK_COUNT }, (_, index) => ({
    id: String(index + 1),
    name: `Track ${index + 1}`,
    tasks: index === 0 ? cloneTasks(sampleTasks) : [],
  }))
}

export function nextTrackName(tracks: GanttTrack[]): string {
  const numbers = tracks.map((track) => {
    const match = /^Track\s+(\d+)$/i.exec(track.name.trim())
    return match ? Number.parseInt(match[1], 10) : 0
  })
  const next = Math.max(0, ...numbers) + 1
  return `Track ${next}`
}
