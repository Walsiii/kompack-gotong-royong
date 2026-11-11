import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Celebration } from './components/Celebration'
import { Shell } from './components/Shell'
import { Logo } from './components/art'
import { ToastHost } from './components/ui'
import { useGeoWatcher } from './lib/location'
import { useHydrated, useIsRT, useStore } from './lib/store'
import { Group } from './screens/Group'
import { Leaderboard } from './screens/Leaderboard'
import { MapHome } from './screens/MapHome'
import { Me } from './screens/Me'
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
    <motion.div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-plang" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        <Logo size={48} light />
      </motion.div>
      <div className="reflect-stripes mt-5 h-2 w-32 rounded-full" style={{ animation: 'kp-sweep 1.2s linear infinite' }} />
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
        <Route path="/quest/:id" element={<QuestFlow />} />
        <Route path="/lapor" element={<Report />} />
        <Route path="/grup" element={<Group />} />
        <Route path="/peringkat" element={<Leaderboard />} />
        <Route path="/aku" element={<Me />} />
        <Route path="/rt/periksa" element={ketua(<Inbox />)} />
        <Route path="/rt/cek/:id" element={ketua(<ReviewSub />)} />
        <Route path="/rt/laporan/:id" element={ketua(<ReviewReport />)} />
        <Route path="/rt/quest-baru" element={ketua(<QuestEditor />)} />
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
  useGeoWatcher()

  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 900)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const roll = () => useStore.getState().rollDemo()
    roll()
    const id = setInterval(roll, 60000)
    return () => clearInterval(id)
  }, [hydrated])

  const ready = hydrated && minTime
  return (
    <HashRouter>
      {ready && (registered ? <Screens /> : <Onboarding />)}
      <AnimatePresence>{!ready && <Splash key="splash" />}</AnimatePresence>
      <ToastHost />
    </HashRouter>
  )
}
