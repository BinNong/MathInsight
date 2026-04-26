import { useState } from 'react'
import axios from 'axios'

interface GenerateResponse {
  success: boolean
  video_url?: string
  iterations?: number
  message?: string
  error?: string
}

const EXAMPLE_DESCRIPTIONS = [
  "制作一个动画，展示 sin 函数图像从 0 到 2π 的生长过程",
  "展示单位圆被矩阵 [[1, 1], [0, 1]] 变换成椭圆的过程",
  "演示 y = x^2 函数图像及其切线的动态绘制",
  "展示一个向量从原点出发，逐渐延长指向 (3, 4) 的动画",
  "制作一个动画，展示圆形逐渐变成正方形的变换过程"
]

export default function ManimAnimation() {
  const [description, setDescription] = useState('')
  const [resolution, setResolution] = useState('720p')
  const [fps, setFps] = useState(30)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('请输入动画描述')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await axios.post<GenerateResponse>('/api/manim/generate', {
        description: description.trim(),
        resolution,
        fps
      })

      setResult(response.data)

      if (!response.data.success) {
        setError(response.data.error || '生成失败')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '请求失败，请检查服务器是否运行')
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setDescription(example)
    setError(null)
    setResult(null)
  }

  const getFullVideoUrl = (relativeUrl: string) => {
    // 处理相对路径，添加后端地址
    if (relativeUrl.startsWith('/')) {
      return relativeUrl
    }
    return relativeUrl
  }

  return (
    <div className="manim-container" style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Manim 动画生成器</h1>
        <p style={styles.subtitle}>
          使用自然语言描述你想要生成的数学动画，AI 将自动创建并渲染视频
        </p>
      </div>

      <div style={styles.content}>
        {/* 输入区域 */}
        <div style={styles.inputSection}>
          <label style={styles.label}>描述你想生成的动画</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：制作一个动画，展示 sin 函数图像从 0 到 2π 的生长过程"
            style={styles.textarea}
            rows={4}
          />

          {/* 示例 */}
          <div style={styles.examples}>
            <span style={styles.examplesLabel}>试试这些例子：</span>
            {EXAMPLE_DESCRIPTIONS.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                style={styles.exampleButton}
              >
                {example.slice(0, 30)}...
              </button>
            ))}
          </div>

          {/* 参数选项 */}
          <div style={styles.options}>
            <div style={styles.optionGroup}>
              <label style={styles.optionLabel}>分辨率</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                style={styles.select}
              >
                <option value="720p">720p (1280x720)</option>
                <option value="1080p">1080p (1920x1080)</option>
                <option value="4k">4K (3840x2160)</option>
              </select>
            </div>

            <div style={styles.optionGroup}>
              <label style={styles.optionLabel}>帧率</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                style={styles.select}
              >
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              ...styles.generateButton,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '生成中...' : '生成动画'}
          </button>

          {/* 错误提示 */}
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}
        </div>

        {/* 结果区域 */}
        <div style={styles.resultSection}>
          {result?.success && result.video_url ? (
            <div style={styles.successBox}>
              <h3 style={styles.successTitle}>生成成功!</h3>
              <p style={styles.iterationsInfo}>
                迭代次数: {result.iterations}
              </p>

              <video
                controls
                style={styles.video}
                src={getFullVideoUrl(result.video_url)}
              >
                您的浏览器不支持 video 标签
              </video>

              <a
                href={getFullVideoUrl(result.video_url)}
                download
                style={styles.downloadButton}
              >
                下载视频
              </a>
            </div>
          ) : null}

          {/* 加载状态 */}
          {loading && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
              <p>正在生成动画，请稍候...</p>
              <p style={styles.loadingHint}>
                首次生成可能需要较长时间（LLM 生成代码 + 渲染视频）
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: '2rem',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#fff'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    background: 'linear-gradient(90deg, #00d9ff, #00ff88)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#aaa'
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  inputSection: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2rem'
  },
  label: {
    display: 'block',
    fontSize: '1.1rem',
    marginBottom: '0.5rem',
    color: '#00d9ff'
  },
  textarea: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit'
  },
  examples: {
    marginTop: '1rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center'
  },
  examplesLabel: {
    fontSize: '0.9rem',
    color: '#888'
  },
  exampleButton: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.85rem',
    background: 'rgba(0, 217, 255, 0.1)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    borderRadius: '20px',
    color: '#00d9ff',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  options: {
    display: 'flex',
    gap: '2rem',
    marginTop: '1.5rem'
  },
  optionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  optionLabel: {
    fontSize: '0.9rem',
    color: '#aaa'
  },
  select: {
    padding: '0.5rem 1rem',
    fontSize: '1rem',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    cursor: 'pointer'
  },
  generateButton: {
    width: '100%',
    marginTop: '1.5rem',
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    background: 'linear-gradient(90deg, #00d9ff, #00ff88)',
    border: 'none',
    borderRadius: '12px',
    color: '#1a1a2e',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  error: {
    marginTop: '1rem',
    padding: '1rem',
    background: 'rgba(255, 82, 82, 0.1)',
    border: '1px solid rgba(255, 82, 82, 0.3)',
    borderRadius: '8px',
    color: '#ff5252'
  },
  resultSection: {
    marginTop: '2rem'
  },
  successBox: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2rem',
    textAlign: 'center'
  },
  successTitle: {
    fontSize: '1.5rem',
    color: '#00ff88',
    marginBottom: '0.5rem'
  },
  iterationsInfo: {
    color: '#888',
    fontSize: '0.9rem',
    marginBottom: '1rem'
  },
  video: {
    width: '100%',
    maxWidth: '640px',
    borderRadius: '12px',
    marginBottom: '1rem'
  },
  downloadButton: {
    display: 'inline-block',
    padding: '0.8rem 2rem',
    background: '#00d9ff',
    color: '#1a1a2e',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 'bold'
  },
  loadingBox: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '3rem',
    textAlign: 'center'
  },
  spinner: {
    width: '50px',
    height: '50px',
    margin: '0 auto 1rem',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #00d9ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingHint: {
    fontSize: '0.9rem',
    color: '#888',
    marginTop: '0.5rem'
  }
}

// 添加 spinner 动画
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`
document.head.appendChild(styleSheet)
