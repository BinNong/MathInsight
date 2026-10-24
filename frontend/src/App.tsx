import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoadingState from './components/LoadingState'

const Home = lazy(() => import('./pages/Home'))
const SubjectPage = lazy(() => import('./pages/SubjectPage'))
const EpsilonDeltaLimit = lazy(() => import('./pages/EpsilonDeltaLimit'))
const DerivativeTangent = lazy(() => import('./pages/DerivativeTangent'))
const MatrixTransform = lazy(() => import('./pages/MatrixTransform'))
const ProbabilitySim = lazy(() => import('./pages/ProbabilitySim'))
const CentralLimitTheorem = lazy(() => import('./pages/CentralLimitTheorem'))
const ProbabilityDistributions = lazy(() => import('./pages/ProbabilityDistributions'))
const TaylorSeries = lazy(() => import('./pages/TaylorSeries'))
const RiemannIntegral = lazy(() => import('./pages/RiemannIntegral'))
const MultivariateFunction = lazy(() => import('./pages/MultivariateFunction'))
const VectorFieldLineIntegrals = lazy(() => import('./pages/VectorFieldLineIntegrals'))
const VectorField3D = lazy(() => import('./pages/VectorField3D'))
const SurfaceIntegrals = lazy(() => import('./pages/SurfaceIntegrals'))
const GaussTheorem = lazy(() => import('./pages/GaussTheorem'))
const ManimAnimation = lazy(() => import('./pages/ManimAnimation'))
const MathSolver = lazy(() => import('./pages/MathSolver'))
const KnowledgeMap = lazy(() => import('./pages/KnowledgeMap'))
const WorldPage = lazy(() => import('./world/WorldPage'))
const World2DPage = lazy(() => import('./world2d/World2DPage'))

function App() {
  return (
    <BrowserRouter basename="/mathinsight">
      <div className="app-container">
        <Suspense fallback={<LoadingState text="页面加载中..." />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/subject/:subjectId" element={<SubjectPage />} />
            <Route path="/limit" element={<EpsilonDeltaLimit />} />
            <Route path="/derivative" element={<DerivativeTangent />} />
            <Route path="/taylor" element={<TaylorSeries />} />
            <Route path="/matrix" element={<MatrixTransform />} />
            <Route path="/probability" element={<ProbabilitySim />} />
            <Route path="/clt" element={<CentralLimitTheorem />} />
            <Route path="/distributions" element={<ProbabilityDistributions />} />
            <Route path="/integration" element={<RiemannIntegral />} />
            <Route path="/multivariate" element={<MultivariateFunction />} />
            <Route path="/vector-field" element={<VectorFieldLineIntegrals />} />
            <Route path="/vector-field-3d" element={<VectorField3D />} />
            <Route path="/surface-integral" element={<SurfaceIntegrals />} />
            <Route path="/gauss-theorem" element={<GaussTheorem />} />
            <Route path="/manim" element={<ManimAnimation />} />
            <Route path="/solver" element={<MathSolver />} />
            <Route path="/knowledge-map" element={<KnowledgeMap />} />
            <Route path="/world" element={<WorldPage />} />
            <Route path="/world-2d" element={<World2DPage />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App
