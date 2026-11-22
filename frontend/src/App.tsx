import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingState from './components/LoadingState'
import AppErrorBoundary from './components/AppErrorBoundary'
import RouteState from './components/RouteState'
import UserBadge from './components/UserBadge'
import { getModuleByPath, getSubjectById } from './data/subjects'
import { useLearningProgress } from './hooks/useLearningProgress'
import { useAuthStore } from './stores/authStore'
import { pullAndMerge, schedulePush } from './services/progressSync'
import { useMasteryStore } from './world2d/store'
import { useReviewStore } from './stores/reviewStore'
import { useStudyLogStore } from './stores/studyLogStore'
import { authApi } from './services/api'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const PracticePage = lazy(() => import('./pages/PracticePage'))

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
const DirectionField = lazy(() => import('./pages/DirectionField'))
const Eigenvalues = lazy(() => import('./pages/Eigenvalues'))
const HypothesisTesting = lazy(() => import('./pages/HypothesisTesting'))
const ManimAnimation = lazy(() => import('./pages/ManimAnimation'))
const MathSolver = lazy(() => import('./pages/MathSolver'))
const KnowledgeMap = lazy(() => import('./pages/KnowledgeMap'))
const WorldPage = lazy(() => import('./world/WorldPage'))
const World2DPage = lazy(() => import('./world2d/World2DPage'))

function RouteEffects() {
  const { pathname } = useLocation()
  const { recordRecent } = useLearningProgress()
  const learningModule = getModuleByPath(pathname)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    const subject = pathname.startsWith('/subject/')
      ? getSubjectById(pathname.split('/').pop())
      : undefined
    const title =
      pathname === '/'
        ? '学习工作台'
        : pathname === '/login'
          ? '登录'
          : pathname === '/register'
            ? '注册'
            : pathname === '/admin'
              ? '管理后台'
              : pathname === '/practice'
                ? '题库练习'
                : (learningModule?.topicName ?? learningModule?.name ?? subject?.name ?? '页面未找到')
    document.title = `${title} | MathInsight`
  }, [pathname, learningModule])

  useEffect(() => {
    if (learningModule) recordRecent(learningModule.id)
  }, [learningModule, recordRecent])

  return null
}

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user?.is_admin) {
    return <Navigate to={`/?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)

  // 以服务端为准刷新登录态，避免本地缓存的角色信息过期
  useEffect(() => {
    if (!token) return
    let cancelled = false
    authApi.me()
      .then((user) => { if (!cancelled) setUser(user) })
      .catch(() => { /* 拦截器已处理失效登录态 */ })
    return () => { cancelled = true }
  }, [token, setUser])

  // 云端进度：有令牌即拉取合并；本地数据变更时防抖上报
  useEffect(() => {
    if (!token) return
    pullAndMerge().catch(() => {})
    const unsub = useMasteryStore.subscribe(() => schedulePush())
    const unsubReview = useReviewStore.subscribe(() => schedulePush())
    const unsubStudyLog = useStudyLogStore.subscribe(() => schedulePush())
    const onProgressChanged = () => schedulePush()
    window.addEventListener('mathinsight:progress-changed', onProgressChanged)
    return () => {
      unsub()
      unsubReview()
      unsubStudyLog()
      window.removeEventListener('mathinsight:progress-changed', onProgressChanged)
    }
  }, [token])

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  return (
    <div className="app-container">
      <RouteEffects />
      {!isAuthPage && <UserBadge />}
      <AppErrorBoundary key={location.pathname}>
        <Suspense fallback={<LoadingState text="页面加载中..." />}>
          <Routes location={location}>
            {/* 公开路由：登录与注册 */}
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />

            {/* 受保护路由：需登录 */}
            <Route element={<RequireAuth><Outlet /></RequireAuth>}>
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
              <Route path="/direction-field" element={<DirectionField />} />
              <Route path="/eigenvalues" element={<Eigenvalues />} />
              <Route path="/hypothesis-test" element={<HypothesisTesting />} />
              <Route path="/manim" element={<ManimAnimation />} />
              <Route path="/solver" element={<MathSolver />} />
              <Route path="/knowledge-map" element={<KnowledgeMap />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
              <Route path="/world" element={<WorldPage />} />
              <Route path="/world-2d" element={<World2DPage />} />
              <Route
                path="*"
                element={
                  <RouteState
                    code="404"
                    title="这条学习路径不存在"
                    description="链接可能已失效或输入有误。返回学习工作台，可以通过搜索重新找到需要的实验或工具。"
                  />
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename="/mathinsight">
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
