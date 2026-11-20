export interface World2DHandle {
  stop: () => void
  teleport: (x: number, y: number) => void
  mobPositions: () => { x: number; y: number; kind: string; hp: number }[]
  fillMp: () => void
  scene: () => string
  enterDungeon: () => void
  leaveDungeon: () => void
  startTrial: () => void
  clearWave: () => void
  damagePlayer: (amount: number) => void
  killPlayer: () => void
  trial: () => {
    active: boolean
    wave: number
    phase: 'countdown' | 'fighting' | 'cleared'
    best: number
  }
}

declare global {
  interface Window {
    __world2d: World2DHandle
  }
}
