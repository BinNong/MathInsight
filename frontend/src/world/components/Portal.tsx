import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makePortalTexture, makeTextTexture } from '../lib/textures'
import { playerPosition, useWorldStore } from '../store'

interface PortalProps {
  position: [number, number, number]
  route: string
  title: string
  color?: string
}

const TRIGGER_DIST = 2.1
const PROMPT_DIST = 7

/** 传送门：发光圆环 + 旋涡盘面，走进即打开对应的交互实验室浮层 */
export default function Portal({ position, route, title, color = '#7dd3fc' }: PortalProps) {
  const discRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const wasNear = useRef(false)
  const center = useMemo(() => new THREE.Vector3(...position), [position])

  const portalTex = useMemo(() => makePortalTexture(color), [color])
  const label = useMemo(() => makeTextTexture(title, { fontSize: 48 }), [title])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (discRef.current) {
      discRef.current.rotation.z = -t * 1.4
    }
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2.2) * 0.03
      ringRef.current.scale.setScalar(s)
    }

    const { started, overlay, openOverlay, setPrompt } = useWorldStore.getState()
    if (!started || overlay) return
    const dist = Math.hypot(playerPosition.x - center.x, playerPosition.z - center.z)
    if (dist < TRIGGER_DIST) {
      if (!wasNear.current) {
        wasNear.current = true
        openOverlay({ route, title })
      }
    } else {
      wasNear.current = false
      if (dist < PROMPT_DIST) {
        setPrompt(`走进光环 → ${title}`)
      } else if (useWorldStore.getState().prompt === `走进光环 → ${title}`) {
        setPrompt(null)
      }
    }
  })

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.7, 0.12, 12, 64]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={discRef}>
        <circleGeometry args={[1.55, 48]} />
        <meshBasicMaterial
          map={portalTex}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* 顶部标签 */}
      <mesh position={[0, 2.5, 0]}>
        <planeGeometry args={[1.3 * label.aspect, 1.3]} />
        <meshBasicMaterial map={label.texture} transparent side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={6} distance={9} />
    </group>
  )
}
