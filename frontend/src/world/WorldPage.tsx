import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
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
import { WorldErrorBoundary, WorldErrorFallback } from './ui/WorldError'
import './world.css'

function detectWebGLIssue(): string | null {
  if (typeof document === 'undefined') return '当前环境不支持浏览器 3D 渲染。'
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      return '浏览器未能创建 WebGL 2 场景。请开启硬件加速，或改用支持 WebGL 2 的桌面浏览器。'
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  } catch {
    return '浏览器阻止了 WebGL 2 初始化。请检查浏览器的图形加速与隐私设置。'
  }
}

function WebGLContextGuard({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onLost])

  return null
}

/** 3D 数学宇宙群岛 —— 第一人称漫游入口页 */
export default function WorldPage() {
  const started = useWorldStore((s) => s.started)
  const overlay = useWorldStore((s) => s.overlay)
  const dialogOpen = useWorldStore((s) => s.dialogOpen)
  const lockControls = useWorldStore((s) => s.lockControls)
  const [sceneError, setSceneError] = useState<string | null>(detectWebGLIssue)
  const handleContextLost = useCallback(() => {
    document.exitPointerLock?.()
    setSceneError('WebGL 图形连接已中断。请重新加载世界；若问题持续，请关闭部分占用显存的页面。')
  }, [])

  // 鼠标未锁定且可以游戏时，点击任意处重新锁定
  const handleClick = () => {
    if (started && !sceneError && !overlay && !dialogOpen && !document.pointerLockElement) {
      lockControls?.()
    }
  }

  return (
    <div className="world-root" onClick={handleClick}>
      <Link
        className="world-home-link"
        to="/"
        title="返回首页；游戏中可先按 Esc 释放鼠标"
        onClick={(event) => {
          event.stopPropagation()
          document.exitPointerLock?.()
        }}
      >
        ← 返回首页
      </Link>
      <WorldErrorBoundary>
        {sceneError ? (
          <WorldErrorFallback message={sceneError} />
        ) : (
          <>
            <Canvas
              shadows
              dpr={[1, 1.75]}
              camera={{ fov: 72, near: 0.1, far: 1200, position: [0, 2.2, 10] }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
            >
              <WebGLContextGuard onLost={handleContextLost} />
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
                <Portal
                  position={[0, 2.2, -9]}
                  route="/knowledge-map"
                  title="知识星图"
                  color="#f0abfc"
                />
                <Portal
                  position={[-4.5, 2.2, -59]}
                  route="/limit"
                  title="ε-δ 极限实验室"
                  color="#67e8f9"
                />
                <Portal
                  position={[4.5, 2.2, -59]}
                  route="/derivative"
                  title="导数与切线实验室"
                  color="#34d399"
                />
                <Portal
                  position={[43, gradientHeight(43, 6) + 2.2, 6]}
                  route="/multivariate"
                  title="多元函数实验室"
                  color="#22d3ee"
                />
                <Portal
                  position={[-49, 2.2, 8]}
                  route="/matrix"
                  title="矩阵变换实验室"
                  color="#a78bfa"
                />
                <Portal
                  position={[-6, 2.2, 44]}
                  route="/probability"
                  title="大数定律实验室"
                  color="#fcd34d"
                />
                <Portal
                  position={[6, 2.2, 44]}
                  route="/clt"
                  title="中心极限定理实验室"
                  color="#fb923c"
                />
              </Suspense>
              <Player />
              <Effects />
            </Canvas>
            <Hud />
            <Intro />
            <Dialog />
            <ModuleOverlay />
          </>
        )}
      </WorldErrorBoundary>
    </div>
  )
}
