import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { heightAt } from '../lib/terrain'
import { resolveObstacles } from '../lib/collision'
import { SPAWN, playerPosition, useWorldStore } from '../store'

const EYE = 1.7 // 视线高度
const GRAVITY = 24
const WALK_SPEED = 6
const SPRINT_SPEED = 10
const JUMP_SPEED = 8.5
const PLAYER_RADIUS = 0.45
const FALL_RESET_Y = -30

/** 第一人称控制器：WASD 移动、Shift 冲刺、空格跳跃、地形贴合与坠落重生 */
export default function Player() {
  const controlsRef = useRef<PointerLockControlsImpl>(null)
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const vy = useRef(0)
  const onGround = useRef(true)
  const overlay = useWorldStore((s) => s.overlay)
  const dialogOpen = useWorldStore((s) => s.dialogOpen)

  useEffect(() => {
    camera.position.copy(SPAWN)
    camera.lookAt(0, 1.8, 0)
    playerPosition.copy(SPAWN)
  }, [camera])

  useEffect(() => {
    useWorldStore.getState().setLockControls(() => () => controlsRef.current?.lock())
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // 浮层 / 对话框打开时释放鼠标，便于点击
  useEffect(() => {
    if (overlay || dialogOpen) {
      document.exitPointerLock?.()
    }
  }, [overlay, dialogOpen])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const p = playerPosition
    const locked = document.pointerLockElement != null

    if (locked) {
      const k = keys.current
      const fwd = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0)
      const strafe = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0)
      const speed = k['ShiftLeft'] || k['ShiftRight'] ? SPRINT_SPEED : WALK_SPEED

      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      dir.y = 0
      dir.normalize()
      const right = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP)
      const move = new THREE.Vector3().addScaledVector(dir, fwd).addScaledVector(right, strafe)
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt)
        const [nx, nz] = resolveObstacles(p.x + move.x, p.z + move.z, PLAYER_RADIUS)
        p.x = nx
        p.z = nz
      }
      if (onGround.current && k['Space']) {
        vy.current = JUMP_SPEED
        onGround.current = false
      }
    }

    // 重力与地形贴合
    vy.current -= GRAVITY * dt
    let ny = p.y + vy.current * dt
    const ground = heightAt(p.x, p.z)
    const floorY = ground === null ? -Infinity : ground + EYE
    if (ny <= floorY) {
      ny = floorY
      vy.current = 0
      onGround.current = true
    } else {
      onGround.current = false
    }
    p.y = ny

    // 坠落出世界：重生
    if (p.y < FALL_RESET_Y) {
      p.copy(SPAWN)
      vy.current = 0
    }

    camera.position.copy(p)
  })

  return <PointerLockControls ref={controlsRef} makeDefault />
}
