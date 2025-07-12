import { Routes, Route } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { CompileRestoreInterface } from './components/CompileRestore'
import { UniswapPools } from './components/UniswapPools/UniswapPools'
import { StatsDashboard } from './components/StatsDashboard/StatsDashboard'
import { ResponsivePanelNavigation } from './components/ResponsivePanelNavigation'
import { useAccount } from 'wagmi'
import { useState } from 'react'
import styles from './App.module.css'

const MainPage = () => {
  useAccount()
  const [currentPanel, setCurrentPanel] = useState(1) // 0: Stats, 1: Compiler, 2: Pools
  const [viewMode, setViewMode] = useState<'single' | 'twoPanel'>('single') // For tablet: single panel or stats+pools

  const handlePanelChange = (panelIndex: number) => {
    if (panelIndex === 3) { // Special case: show stats + pools together (tablet mode)
      setViewMode('twoPanel')
      setCurrentPanel(0) // Default to stats for active state
    } else {
      setViewMode('single')
      setCurrentPanel(panelIndex)
    }
  }

  return (
    <div className={`${styles.contentAnimate} ${styles.connected}`}>
      <main className={`${styles.unifiedMainContainer} ${viewMode === 'twoPanel' ? styles.twoPanel : ''}`}>
        {/* Performance-optimized responsive grid */}
        <div className={styles.responsivePanelsGrid}>
          <div className={`${styles.panelStats} ${(currentPanel === 0 || viewMode === 'twoPanel') ? styles.active : ''}`}>
            <StatsDashboard />
          </div>
          <div className={`${styles.panelCompiler} ${currentPanel === 1 ? styles.active : ''}`}>
            <CompileRestoreInterface />
          </div>
          <div className={`${styles.panelPools} ${(currentPanel === 2 || viewMode === 'twoPanel') ? styles.active : ''}`}>
            <UniswapPools />
          </div>
        </div>
        
        {/* Responsive Panel Navigation */}
        <ResponsivePanelNavigation
          currentPanel={currentPanel}
          viewMode={viewMode}
          onPanelChange={handlePanelChange}
          className={styles.panelNavigation}
        />
      </main>
    </div>
  )
}

function App() {
  return (
    <div>
      <NavBar />
      <Routes>
        <Route path="/" element={<MainPage />} />
      </Routes>
    </div>
  )
}

export default App