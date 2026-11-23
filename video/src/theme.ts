/** 站点视觉体系在视频里的映射：纸张质感 + 学术红 */
export const theme = {
  paper: '#F7F4EC',
  paperAlt: '#EFEAE0',
  ink: '#2B2622',
  inkSoft: '#6B625A',
  accent: '#9C3B2E',
  accentSoft: '#C46A54',
  blue: '#2C6E8F',
  line: '#D9D1C4',
  gold: '#B08D3F',
  fontSerif: 'Songti SC, SimSun, Noto Serif CJK SC, serif',
  fontSans: 'PingFang SC, Microsoft YaHei, sans-serif',
  width: 1280,
  height: 720,
}

/** 深空主题：天文题材用，冲击力更强 */
export const spaceTheme = {
  ...theme,
  paper: '#0B1020',
  paperAlt: '#141C33',
  ink: '#F2F5FA',
  inkSoft: '#A9B6CC',
  accent: '#E0764A',
  accentSoft: '#F09A6A',
  blue: '#5AA7D6',
  line: '#2A3550',
  gold: '#E9C46A',
}

export function themeFor(kind: string) {
  return kind === 'space' ? spaceTheme : theme
}

export type Theme = typeof theme
