import { Routes, Route } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { CompileRestoreInterface } from './components/CompileRestore'
import { UniswapPools } from './components/UniswapPools/UniswapPools'
import { StatsDashboard } from './components/StatsDashboard/StatsDashboard'
import { useAccount } from 'wagmi'
import { useState } from 'react'

const MainPage = () => {
  const { isConnected } = useAccount()
  const [currentPanel, setCurrentPanel] = useState(1) // 0: Stats, 1: Compiler, 2: Pools

  return (
    <div className={`content-animate ${isConnected ? 'connected' : 'disconnected'}`}>
      {isConnected ? (
        <>
          {/* Mobile Navigation */}
          <div className="mobile-nav">
            <button
              className={`nav-btn ${currentPanel === 0 ? 'active' : ''}`}
              onClick={() => setCurrentPanel(0)}
            >
              Stats
            </button>
            <button
              className={`nav-btn ${currentPanel === 1 ? 'active' : ''}`}
              onClick={() => setCurrentPanel(1)}
            >
              Compiler
            </button>
            <button
              className={`nav-btn ${currentPanel === 2 ? 'active' : ''}`}
              onClick={() => setCurrentPanel(2)}
            >
              Pools
            </button>
          </div>
          
          {/* Desktop Layout */}
          <main className="main-content">
            <div className="stats-focus">
              <StatsDashboard />
            </div>
            <div className="compiler-focus">
              <CompileRestoreInterface />
            </div>
            <div className="pools-focus">
              <UniswapPools />
            </div>
          </main>
          
          {/* Mobile Carousel */}
          <div className="mobile-carousel">
            <div className="carousel-container">
              <div className={`carousel-panel ${currentPanel === 0 ? 'active' : ''}`}>
                <StatsDashboard />
              </div>
              <div className={`carousel-panel ${currentPanel === 1 ? 'active' : ''}`}>
                <CompileRestoreInterface />
              </div>
              <div className={`carousel-panel ${currentPanel === 2 ? 'active' : ''}`}>
                <UniswapPools />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="connect-message glass-card" style={{ maxWidth: '500px', margin: '20px auto' }}>
          <p>
            Please connect your wallet to continue
          </p>
        </div>
      )}
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

      <style>{`
        .content-animate {
          transition: all 0.4s ease;
        }
        
        .content-animate.connected {
          opacity: 1;
          transform: scale(1);
        }
        
        .content-animate.disconnected {
          opacity: 0.8;
          transform: scale(0.95);
        }

        .main-content {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 40px 20px;
          gap: 4px;
          min-height: calc(100vh - 89px);
        }

        .stats-focus {
          flex: 0 1 400px;
        }

        .compiler-focus {
          flex: 0 1 750px;
        }

        .pools-focus {
          flex: 0 1 400px;
        }

        /* Mobile Navigation */
        .mobile-nav {
          display: none;
          justify-content: center;
          padding: 20px;
          gap: 10px;
          background: rgba(20, 20, 35, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .nav-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          font-weight: 500;
        }

        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .nav-btn.active {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
          color: rgba(255, 255, 255, 0.95);
        }

        /* Mobile Carousel */
        .mobile-carousel {
          display: none;
          padding: 20px;
          min-height: calc(100vh - 160px);
        }

        .carousel-container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .carousel-panel {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
          transform: translateX(20px);
        }

        .carousel-panel.active {
          opacity: 1;
          visibility: visible;
          transform: translateX(0);
        }

        /* Responsive breakpoints */
        @media (max-width: 1200px) {
          .main-content {
            justify-content: center;
            flex-wrap: wrap;
            gap: 20px;
          }
          .main-content::before {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .main-content {
            display: none;
          }
          
          .mobile-nav {
            display: flex;
          }
          
          .mobile-carousel {
            display: block;
          }
        }
      `}</style>
    </div>
  )
}

export default App