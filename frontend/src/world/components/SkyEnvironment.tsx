import * as THREE from 'three'
import { Sky, Stars, Clouds, Cloud } from '@react-three/drei'

/** drei 默认云纹理走 CDN，离线会挂起整个 Suspense —— 使用本地生成的纹理 */
const CLOUD_TEXTURE = `${import.meta.env.BASE_URL}textures/cloud.png`

/** 黄昏星云天空、光照、远处「数学之星」与脚下云海 */
export default function SkyEnvironment() {
  return (
    <>
      <fogExp2 attach="fog" args={['#241335', 0.005]} />

      {/* 太阳放低：树影拉长到可视；光晕小不糊屏 */}
      <Sky
        distance={4000}
        sunPosition={[100, 110, 130]}
        turbidity={6}
        rayleigh={2.4}
        mieCoefficient={0.008}
        mieDirectionalG={0.85}
      />
      <Stars radius={280} depth={80} count={5000} factor={5} saturation={0.6} fade speed={0.6} />

      <ambientLight intensity={0.32} color="#8b93c9" />
      <hemisphereLight args={['#4a3a7a', '#170c2a', 0.45]} />
      {/* 主光源：唯一投影灯，阴影相机覆盖整个群岛 */}
      <directionalLight
        position={[100, 110, 130]}
        intensity={2.0}
        color="#ffb37a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-85}
        shadow-camera-right={85}
        shadow-camera-top={85}
        shadow-camera-bottom={-85}
        shadow-camera-near={60}
        shadow-camera-far={420}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-80, 50, -120]} intensity={0.4} color="#6fd3ff" />

      {/* 远处的「数学之星」与它的光环（天顶附近，不挡主视线） */}
      <group position={[180, 130, -220]}>
        <mesh>
          <sphereGeometry args={[20, 32, 32]} />
          <meshBasicMaterial color="#ffd9a0" />
        </mesh>
        <mesh rotation={[Math.PI / 2.5, 0.4, 0]}>
          <torusGeometry args={[32, 1.3, 12, 90]} />
          <meshBasicMaterial color="#f0abfc" transparent opacity={0.7} />
        </mesh>
      </group>

      {/* 脚下云海 */}
      <Clouds material={THREE.MeshBasicMaterial} limit={300} texture={CLOUD_TEXTURE}>
        <Cloud
          seed={7}
          segments={36}
          bounds={[70, 10, 70]}
          volume={90}
          position={[0, -30, 0]}
          color="#b9a8e6"
          opacity={0.45}
          speed={0.1}
        />
        <Cloud
          seed={21}
          segments={28}
          bounds={[50, 8, 50]}
          volume={70}
          position={[60, -38, -40]}
          color="#8fa8e0"
          opacity={0.35}
          speed={0.14}
        />
        <Cloud
          seed={33}
          segments={28}
          bounds={[50, 8, 50]}
          volume={70}
          position={[-70, -36, 50]}
          color="#c9b4ec"
          opacity={0.35}
          speed={0.12}
        />
      </Clouds>
    </>
  )
}
