import { create } from 'zustand'
import * as THREE from 'three'

export interface OverlayTarget {
  route: string
  title: string
}

interface WorldState {
  started: boolean
  overlay: OverlayTarget | null
  dialogOpen: boolean
  prompt: string | null
  objective: string
  goalReached: boolean
  lockControls: (() => void) | null
  setStarted: (v: boolean) => void
  openOverlay: (t: OverlayTarget) => void
  closeOverlay: () => void
  setDialogOpen: (v: boolean) => void
  setPrompt: (p: string | null) => void
  setObjective: (o: string) => void
  setGoalReached: (v: boolean) => void
  setLockControls: (fn: (() => void) | null) => void
}

export const useWorldStore = create<WorldState>((set) => ({
  started: false,
  overlay: null,
  dialogOpen: false,
  prompt: null,
  objective: '探索群岛：穿过光桥，前往东方的梯度山脉',
  goalReached: false,
  lockControls: null,
  setStarted: (v) => set({ started: v }),
  openOverlay: (t) => set({ overlay: t }),
  closeOverlay: () => set({ overlay: null }),
  setDialogOpen: (v) => set({ dialogOpen: v }),
  setPrompt: (p) => set({ prompt: p }),
  setObjective: (o) => set({ objective: o }),
  setGoalReached: (v) => set({ goalReached: v }),
  setLockControls: (fn) => set({ lockControls: fn }),
}))

/** 出生点 */
export const SPAWN = new THREE.Vector3(0, 2.2, 10)

/** 每帧可变状态（模块级引用，避免触发 React 重渲染） */
export const playerPosition = new THREE.Vector3().copy(SPAWN)

/** 玩家在梯度山脉上的实时读数（HUD 轮询） */
export const playerStats = {
  onMountain: false,
  height: 0,
  gradMag: 0,
}
