import { useState } from 'react'
import EpsilonDeltaLimit from './pages/EpsilonDeltaLimit'
import DerivativeTangent from './pages/DerivativeTangent'
import MatrixTransform from './pages/MatrixTransform'

type Tab = 'limit' | 'derivative' | 'matrix'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('limit')

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>MathInsight - 高等数学智能教学助手</h1>
        <p>让抽象数学看得见、摸得着、玩得转</p>
      </header>

      <main className="app-main">
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'limit' ? 'active' : ''}`}
            onClick={() => setActiveTab('limit')}
          >
            ε-δ 极限可视化
          </button>
          <button
            className={`nav-tab ${activeTab === 'derivative' ? 'active' : ''}`}
            onClick={() => setActiveTab('derivative')}
          >
            导数与切线
          </button>
          <button
            className={`nav-tab ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            矩阵变换
          </button>
        </nav>

        {activeTab === 'limit' && <EpsilonDeltaLimit />}
        {activeTab === 'derivative' && <DerivativeTangent />}
        {activeTab === 'matrix' && <MatrixTransform />}
      </main>
    </div>
  )
}

export default App
