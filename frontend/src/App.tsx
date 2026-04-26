import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SubjectPage from './pages/SubjectPage'
import EpsilonDeltaLimit from './pages/EpsilonDeltaLimit'
import DerivativeTangent from './pages/DerivativeTangent'
import MatrixTransform from './pages/MatrixTransform'
import ProbabilitySim from './pages/ProbabilitySim'
import TaylorSeries from './pages/TaylorSeries'
import RiemannIntegral from './pages/RiemannIntegral'
import MultivariateFunction from './pages/MultivariateFunction'
import VectorFieldLineIntegrals from './pages/VectorFieldLineIntegrals'
import VectorField3D from './pages/VectorField3D'
import SurfaceIntegrals from './pages/SurfaceIntegrals'
import GaussTheorem from './pages/GaussTheorem'
import ManimAnimation from './pages/ManimAnimation'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subject/:subjectId" element={<SubjectPage />} />
          <Route path="/limit" element={<EpsilonDeltaLimit />} />
          <Route path="/derivative" element={<DerivativeTangent />} />
          <Route path="/taylor" element={<TaylorSeries />} />
          <Route path="/matrix" element={<MatrixTransform />} />
          <Route path="/probability" element={<ProbabilitySim />} />
          <Route path="/integration" element={<RiemannIntegral />} />
          <Route path="/multivariate" element={<MultivariateFunction />} />
          <Route path="/vector-field" element={<VectorFieldLineIntegrals />} />
          <Route path="/vector-field-3d" element={<VectorField3D />} />
          <Route path="/surface-integral" element={<SurfaceIntegrals />} />
          <Route path="/gauss-theorem" element={<GaussTheorem />} />
          <Route path="/manim" element={<ManimAnimation />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
