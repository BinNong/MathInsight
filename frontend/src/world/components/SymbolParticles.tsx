import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeSymbolTexture } from '../lib/textures'

const SYMBOLS = ['∫', '∑', 'π', 'λ', '∇', '∞', '√', 'θ', '∂', '∏', 'φ', 'Δ']
const COLORS = ['#7dd3fc', '#f0abfc', '#fcd34d', '#6ee7b7', '#fca5a5', '#c4b5fd']
const COUNT = 52
const FIREFLY_COUNT = 220

interface FloatItem {
  pos: THREE.Vector3
  scale: number
  tex: THREE.Texture
  speed: number
  phase: number
}

/** 漂浮的数学符号 + 萤火虫粒子，营造「数学宇宙」氛围 */
export default function SymbolParticles() {
  const groupRef = useRef<THREE.Group>(null)
  const fireflyRef = useRef<THREE.Points>(null)

  const items = useMemo<FloatItem[]>(() => {
    const list: FloatItem[] = []
    for (let i = 0; i < COUNT; i++) {
      const symbol = SYMBOLS[i % SYMBOLS.length]
      const color = COLORS[i % COLORS.length]
      // 分布在岛屿之间的空域
      const angle = Math.random() * Math.PI * 2
      const radius = 24 + Math.random() * 70
      list.push({
        pos: new THREE.Vector3(
          Math.cos(angle) * radius,
          3 + Math.random() * 14,
          Math.sin(angle) * radius
        ),
        scale: 1.2 + Math.random() * 1.6,
        tex: makeSymbolTexture(symbol, color),
        speed: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      })
    }
    return list
  }, [])

  const fireflyGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(FIREFLY_COUNT * 3)
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 10 + Math.random() * 85
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = -2 + Math.random() * 18
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const group = groupRef.current
    if (group) {
      group.children.forEach((child, i) => {
        const item = items[i]
        child.position.y = item.pos.y + Math.sin(t * item.speed + item.phase) * 0.9
      })
    }
    if (fireflyRef.current) {
      fireflyRef.current.rotation.y = t * 0.02
    }
  })

  return (
    <>
      <group ref={groupRef}>
        {items.map((item, i) => (
          <sprite key={i} position={item.pos} scale={[item.scale, item.scale, 1]}>
            <spriteMaterial
              map={item.tex}
              transparent
              opacity={0.85}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        ))}
      </group>
      <points ref={fireflyRef} geometry={fireflyGeometry}>
        <pointsMaterial
          size={0.16}
          color="#9fffe0"
          transparent
          opacity={0.7}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}
