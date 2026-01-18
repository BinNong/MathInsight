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
│   └── DerivativeTangent.tsx   # Derivative & linear approximation
├── services/           # API calls
│   └── api.ts
├── components/         # Reusable components
└── utils/              # Utility functions
```

### Backend Structure

```
backend/app/
├── routes/
│   └── calculus.py     # Calculus API endpoints
├── services/
│   └── calculus_service.py  # Calculus computation
└── utils/
    └── math_utils.py   # Math utility functions
```

## Implemented Features (MVP Progress)

| ID | Feature | Module | Status |
|----|---------|--------|--------|
| M1 | ε-δ Limit Visualization | Calculus | ✅ Done |
| M2 | Derivative Enhancement | Calculus | ✅ Done |
| M3 | Matrix Transformations | Linear Algebra | ⏳ Pending |
| M4 | Law of Large Numbers | Probability | ⏳ Pending |

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

## API Endpoints

### Calculus

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calculus/derivative` | POST | Get derivative tangent line data |
| `/api/calculus/derivative/higher` | POST | Get higher-order derivatives |
| `/api/calculus/derivative/linear-approximation` | POST | Get linear approximation data |
| `/api/calculus/epsilon-delta` | POST | Get ε-δ visualization data |

## Design Patterns

- Route handlers in `app/routes/` delegate to service modules
- React components use Plotly for mathematical plotting
- Math utilities in `app/utils/math_utils.py` provide common functions

## Design Guidelines

- Use Plotly for mathematical function plotting
- Ensure responsive visualization that updates in real-time
- Support Chinese mathematical terminology and documentation
