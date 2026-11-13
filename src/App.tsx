import { useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Celebration } from './components/Celebration'
import { Shell } from './components/Shell'
import { Logo } from './components/art'
import { ToastHost, toast } from './components/ui'
import { useGeoWatcher } from './lib/location'
import { connectLive, useLive } from './lib/live'
import { useHydrated, useIsRT, useStore } from './lib/store'
import { Group } from './screens/Group'
import { Leaderboard } from './screens/Leaderboard'
import { MapHome } from './screens/MapHome'
import { Me } from './screens/Me'
import { Character } from './components/KampungBuddy'
import { Onboarding } from './screens/Onboarding'
import { QuestFlow } from './screens/QuestFlow'
import { Report } from './screens/Report'
import { Inbox } from './screens/rt/Inbox'
import { QuestEditor } from './screens/rt/QuestEditor'
import { ReviewReport } from './screens/rt/ReviewReport'
import { ReviewSub } from './screens/rt/ReviewSub'
import { Territory } from './screens/rt/Territory'

function Splash() {
  return (
    <motion.div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center" style={{ background: '#ffc23d' }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div className="w-[150px]" initial={{ y: 40, scale: 0.7, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
        <Character who="kompi" mood="hello" look={false} />
      </motion.div>
      <motion.div className="mt-3" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 18 }}>
        <Logo size={40} mark={false} />
      </motion.div>
    </motion.div>
  )
}

function Screens() {
  const rt = useIsRT()
  const ketua = (el: React.ReactNode) => (rt ? el : <Navigate to="/" replace />)
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<MapHome />} />
        <Route path="/misi/:id" element={<QuestFlow />} />
        <Route path="/lapor" element={<Report />} />
        <Route path="/grup" element={<Group />} />
        <Route path="/peringkat" element={<Leaderboard />} />
        <Route path="/aku" element={<Me />} />
        <Route path="/rt/periksa" element={ketua(<Inbox />)} />
        <Route path="/rt/cek/:id" element={ketua(<ReviewSub />)} />
        <Route path="/rt/laporan/:id" element={ketua(<ReviewReport />)} />
        <Route path="/rt/misi-baru" element={ketua(<QuestEditor />)} />
        <Route path="/rt/wilayah" element={ketua(<Territory />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!rt && <Celebration />}
    </Shell>
  )
}

export default function App() {
  const hydrated = useHydrated()
  const registered = useStore((s) => s.meId !== null)
  const [minTime, setMinTime] = useState(false)
  const liveReady = useLive(s => s.ready)
  const liveError = useLive(s => s.error)
  useGeoWatcher()
  useEffect(() => { if (hydrated) void connectLive(useStore) }, [hydrated])
  useEffect(() => { if (liveError) toast(liveError, 'warn') }, [liveError])

  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 900)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!hydrated || !liveReady || !registered) return
    const roll = () => useStore.getState().rollDemo()
    roll()
    const id = setInterval(roll, 60000)
    return () => clearInterval(id)
  }, [hydrated, liveReady, registered])

  const ready = hydrated && liveReady && minTime
  return (
    <MotionConfig reducedMotion="user"><HashRouter>
      {ready && (registered ? <Screens /> : <Onboarding />)}
      <AnimatePresence>{!ready && <Splash key="splash" />}</AnimatePresence>
      <ToastHost />
    </HashRouter></MotionConfig>
  )
}
