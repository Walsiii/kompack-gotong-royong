import { useMemo } from 'react'
import { distM } from './geo'
import { useMyPos } from './location'
import { takenSlots, useMe, useStore } from './store'
import { questPhase, type Phase } from './time'
import type { LatLng, Post, Quest, Submission } from './types'

export interface QuestView {
  quest: Quest
  phase: Phase
  mySub?: Submission
  taken: number
  full: boolean
  dist: number | null
  inRange: boolean
  /** quest dari laporan/permintaanmu sendiri */
  own: boolean
}

export function buildView(quest: Quest, subs: Submission[], meId: string | undefined, pos: LatLng | null, now: number): QuestView {
  const phase = questPhase(quest, now)
  const mySub = meId ? subs.find((s) => s.questId === quest.id && s.userId === meId && s.status !== 'rejected') ?? subs.find((s) => s.questId === quest.id && s.userId === meId) : undefined
  const taken = takenSlots(subs, quest.id)
  const dist = pos ? distM(pos, quest) : null
  return {
    quest,
    phase,
    mySub,
    taken,
    full: taken >= quest.slots && !mySub,
    dist,
    inRange: dist !== null && dist <= quest.radius,
    own: !!meId && quest.requesterId === meId,
  }
}

export function useQuestViews(now: number): QuestView[] {
  const quests = useStore((s) => s.quests)
  const subs = useStore((s) => s.subs)
  const me = useMe()
  const { pos } = useMyPos()
  return useMemo(() => {
    const views = quests.map((q) => buildView(q, subs, me?.id, pos, now)).filter((v) => v.phase !== 'ended')
    views.sort((a, b) => {
      if (a.phase !== b.phase) return a.phase === 'live' ? -1 : 1
      if (a.phase === 'upcoming') return a.quest.startAt - b.quest.startAt
      return (a.dist ?? 1e9) - (b.dist ?? 1e9)
    })
    return views
  }, [quests, subs, me?.id, pos, now])
}

export function useQuestView(id: string | undefined, now: number): QuestView | null {
  const quest = useStore((s) => s.quests.find((q) => q.id === id))
  const subs = useStore((s) => s.subs)
  const me = useMe()
  const { pos } = useMyPos()
  return useMemo(() => (quest ? buildView(quest, subs, me?.id, pos, now) : null), [quest, subs, me?.id, pos, now])
}

/** Laporan & permintaan tolong yang masih menunggu RT (tampil di peta) */
export function useOpenReports(): Post[] {
  const posts = useStore((s) => s.posts)
  return useMemo(() => posts.filter((p) => (p.kind === 'laporan' || p.kind === 'tolong') && p.status === 'menunggu' && p.lat !== undefined), [posts])
}
