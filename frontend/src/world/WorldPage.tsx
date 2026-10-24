import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { gradientHeight } from './lib/terrain'
import { useWorldStore } from './store'
import Player from './components/Player'
import SkyEnvironment from './components/SkyEnvironment'
import Effects from './components/Effects'
import Islands from './components/Islands'
import SymbolParticles from './components/SymbolParticles'
import Portal from './components/Portal'
import NpcGuide from './components/NpcGuide'
import GradientMountain from './levels/GradientMountain'
import MatrixGate from './levels/MatrixGate'
import ProbabilityRain from './levels/ProbabilityRain'
import Hud from './ui/Hud'
import Intro from './ui/Intro'
import Dialog from './ui/Dialog'
import ModuleOverlay from './ui/ModuleOverlay'

/** 3D 数学宇宙群岛 —— 第一人称漫游入口页 */
export default function WorldPage() {
  const started = useWorldStore((s) => s.started)
  const overlay = useWorldStore((s) => s.overlay)
  const dialogOpen = useWorldStore((s) => s.dialogOpen)
  const lockControls = useWorldStore((s) => s.lockControls)

  // 鼠标未锁定且可以游戏时，点击任意处重新锁定
  const handleClick = () => {
    if (started && !overlay && !dialogOpen && !document.pointerLockElement) {
      lockControls?.()
    }
  }

  return (
    <div className="world-root" onClick={handleClick}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 72, near: 0.1, far: 1200, position: [0, 2.2, 10] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#160a26']} />
        <Suspense fallback={null}>
          <SkyEnvironment />
          <Islands />
          <GradientMountain />
          <MatrixGate />
          <ProbabilityRain />
          <SymbolParticles />
          <NpcGuide />
          {/* 传送门：通往现有 2D 交互实验室 */}
          <Portal position={[0, 2.2, -9]} route="/knowledge-map" title="知识星图" color="#f0abfc" />
          <Portal position={[-4.5, 2.2, -59]} route="/limit" title="ε-δ 极限实验室" color="#67e8f9" />
          <Portal position={[4.5, 2.2, -59]} route="/derivative" title="导数与切线实验室" color="#34d399" />
          <Portal
            position={[43, gradientHeight(43, 6) + 2.2, 6]}
            route="/multivariate"
            title="多元函数实验室"
            color="#22d3ee"
          />
          <Portal position={[-49, 2.2, 8]} route="/matrix" title="矩阵变换实验室" color="#a78bfa" />
          <Portal position={[-6, 2.2, 44]} route="/probability" title="大数定律实验室" color="#fcd34d" />
          <Portal position={[6, 2.2, 44]} route="/clt" title="中心极限定理实验室" color="#fb923c" />
        </Suspense>
        <Player />
        <Effects />
      </Canvas>
      <Hud />
      <Intro />
      <Dialog />
      <ModuleOverlay />
    </div>
  )
}
