import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing'

/** 后处理：泛光（只作用于发光体）+ 暗角 + SMAA 抗锯齿 */
export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.55} luminanceThreshold={0.85} luminanceSmoothing={0.25} mipmapBlur />
      <Vignette eskil={false} offset={0.22} darkness={0.7} />
      <SMAA />
    </EffectComposer>
  )
}
