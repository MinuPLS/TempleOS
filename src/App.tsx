import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import { CompileRestoreInterface } from './components/CompileRestore'
import UniswapPools from './components/UniswapPools/UniswapPools'
import StatsDashboard from './components/StatsDashboard/StatsDashboard'
import { ResponsivePanelNavigation } from './components/ResponsivePanelNavigation'
import { PanelDotNavigation } from './components/PanelDotNavigation'
import { useAccount } from 'wagmi'
import { useState } from 'react'
import styles from './App.module.css'

const MainPage = () => {
  useAccount()
  const [currentPanel, setCurrentPanel] = useState(1) // 0: Stats, 1: Compiler (default), 2: Pools

  return (
    <div className={`${styles.contentAnimate} ${styles.connected}`}>
      <main className={styles.unifiedMainContainer}>
        {/* Navigation above panels on mobile/tablet */}
        <div className={styles.mobileNavigationContainer}>
          <PanelDotNavigation
            currentPanel={currentPanel}
            onPanelChange={setCurrentPanel}
          />
        </div>
        
        {/* Performance-optimized responsive grid */}
        <div className={styles.responsivePanelsGrid}>
          <div className={`${styles.panelStats} ${currentPanel === 0 ? styles.active : ''}`}>
            <StatsDashboard />
          </div>
          <div className={`${styles.panelCompiler} ${currentPanel === 1 ? styles.active : ''}`}>
            <CompileRestoreInterface />
          </div>
          <div className={`${styles.panelPools} ${currentPanel === 2 ? styles.active : ''}`}>
            <UniswapPools />
          </div>
        </div>
        
        {/* Bottom Panel Navigation - Hidden on small screens */}
        <ResponsivePanelNavigation
          currentPanel={currentPanel}
          onPanelChange={setCurrentPanel}
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