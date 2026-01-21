# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathInsight is a web-based高等数学 (Advanced Mathematics) intelligent teaching assistant that provides interactive visualizations for calculus, linear algebra, and probability theory. The product aims to make abstract mathematical concepts visible and explorable through dynamic graphics and real-time computation.

**Target Users**: University professors and STEM students (freshman to junior year)

## Tech Stack

- **Frontend**: React + TypeScript + Plotly.js
- **Backend**: Python Flask + SymPy + NumPy
- **Testing**: Playwright for e2e tests

## Development Commands

```bash
# Run the Flask application (from backend directory)
python run.py

# Run frontend dev server (from frontend directory)
npm run dev

# Build frontend for production
npm run build

# Run Playwright e2e tests
npx playwright test
```

## Architecture

### Frontend Structure

```
frontend/src/
├── pages/              # Main page components
│   ├── EpsilonDeltaLimit.tsx   # ε-δ limit visualization
│   ├── DerivativeTangent.tsx   # Derivative & linear approximation
│   ├── MatrixTransform.tsx     # 2×2 matrix transformation
│   └── ProbabilitySim.tsx      # Law of Large Numbers simulation
├── services/           # API calls
│   └── api.ts
├── components/         # Reusable components
└── utils/              # Utility functions
```

### Backend Structure

```
backend/app/
├── routes/
│   ├── calculus.py         # Calculus API endpoints
│   ├── linear_algebra.py   # Linear algebra API endpoints
│   └── probability.py      # Probability API endpoints
├── services/
│   ├── calculus_service.py     # Calculus computation
│   ├── linear_algebra_service.py  # Matrix operations
│   └── probability_service.py  # Probability simulations
└── utils/
    └── math_utils.py       # Math utility functions
```

## Implemented Features (MVP Progress)

| ID | Feature | Module | Status |
|----|---------|--------|--------|
| M1 | ε-δ Limit Visualization | Calculus | ✅ Done |
| M2 | Derivative Enhancement | Calculus | ✅ Done |
| M3 | Matrix Transformations | Linear Algebra | ✅ Done |
| M4 | Law of Large Numbers | Probability | ✅ Done |

### M1: ε-δ Limit Visualization
- User sets target limit L and ε range
- System auto-calculates δ interval
- Dual-band highlighting for |x−x₀|<δ and |f(x)−L|<ε
- Custom function expressions (x**2, sin(x), etc.)
- Adjustable x₀ position

### M2: Derivative Enhancement
- **Tangent/Normal lines**: Real-time plotting
- **Local linear approximation**: f(x) vs L(x) = f(x₀) + f'(x₀)(x−x₀)
- **Error area coloring**: Visual difference between curve and tangent
- **Higher-order derivatives**: Toggle f, f', f'', f'''
- **Magnifier**: Zoom in to observe curve-tangent convergence
- Supports sin, cos, tan, exp, log, ln, sqrt, etc.

### M3: Matrix Transformations
- **2×2 Matrix Input**: Numeric input fields and sliders
- **Real-time Transformation**: Visualize unit circle → ellipse and grid deformation
- **Preset Templates**: Identity, scale, rotate, shear, reflect, squeeze
- **Eigenvector Display**: Show invariant directions in transformation
- **Determinant Info**: Display area scaling ratio and orientation
- **Basis Vector Tracking**: Show transformed e₁ and e₂ positions

### M4: Law of Large Numbers
- **Monte Carlo Experiments**: Coin toss (Bernoulli) and dice roll (discrete uniform)
- **Real-time Animation**: Visual demonstration of each trial
- **Convergence Curve**: Plot sample mean converging to expected value
- **Distribution Histogram**: Real-time frequency display of sample results
- **Preset Templates**: Fair coin, biased coin, standard dice, custom dice
- **Adjustable Parameters**: Sample size, animation speed

## API Endpoints

### Calculus

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calculus/derivative` | POST | Get derivative tangent line data |
| `/api/calculus/derivative/higher` | POST | Get higher-order derivatives |
| `/api/calculus/derivative/linear-approximation` | POST | Get linear approximation data |
| `/api/calculus/epsilon-delta` | POST | Get ε-δ visualization data |

### Linear Algebra

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/linear-algebra/matrix-transform` | POST | Get 2×2 matrix transformation data |
| `/api/linear-algebra/matrix-presets` | GET | Get preset matrix templates |

### Probability

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/probability/lln/simulate` | POST | Run LLN Monte Carlo simulation |
| `/api/probability/lln/presets` | GET | Get preset experiment configurations |

## Design Patterns

- Route handlers in `app/routes/` delegate to service modules
- React components use Plotly for mathematical plotting
- Math utilities in `app/utils/math_utils.py` provide common functions

## Design Guidelines

- Use Plotly for mathematical function plotting
- Ensure responsive visualization that updates in real-time
- Support Chinese mathematical terminology and documentation
