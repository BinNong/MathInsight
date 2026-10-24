# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathInsight is a web-based 高等数学 (Advanced Mathematics) intelligent teaching assistant that provides interactive visualizations for calculus, linear algebra, probability theory, multivariate calculus, vector calculus, and AI-generated Manim animations. The product aims to make abstract mathematical concepts visible and explorable through dynamic graphics and real-time computation.

**Target Users**: University professors and STEM students (freshman to junior year)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Plotly.js + KaTeX + vis-network + react-router-dom
- **Backend**: Python Flask + SymPy + NumPy + SciPy + Manim + Anthropic/OpenAI SDK
- **Testing**: pytest (backend) + Playwright (frontend e2e)
- **Deployment**: Docker + Nginx

## Development Commands

```bash
# Run the Flask application (from backend directory)
python run.py

# Run backend tests
cd backend && python -m pytest -q

# Run frontend dev server (from frontend directory)
npm run dev

# Build frontend for production
npm run build

# Run frontend lint
cd frontend && npm run lint

# Run Playwright e2e tests
cd frontend && npx playwright test
```

## Architecture

### Frontend Structure

```
frontend/src/
├── pages/              # Main page components
│   ├── EpsilonDeltaLimit.tsx    # ε-δ limit visualization
│   ├── DerivativeTangent.tsx    # Derivative & linear approximation
│   ├── TaylorSeries.tsx         # Taylor series & convergence
│   ├── RiemannIntegral.tsx      # Riemann sums & numerical integration
│   ├── MatrixTransform.tsx      # 2×2 matrix transformation
│   ├── MultivariateFunction.tsx # Multivariate calculus visualization
│   ├── VectorField3D.tsx        # 3D vector fields
│   ├── VectorFieldLineIntegrals.tsx # Line integrals, Green's theorem, Gauss theorem
│   ├── ProbabilitySim.tsx       # Law of large numbers simulation
│   ├── ProbabilityDistributions.tsx # Probability distributions
│   ├── CentralLimitTheorem.tsx  # Central limit theorem simulation
│   ├── ManimAnimation.tsx       # AI-generated Manim animation
│   ├── MathSolver.tsx           # AI math problem-solving tutor
│   └── KnowledgeMap.tsx         # Interactive knowledge graph / learning map
├── services/          # API calls
│   ├── api.ts         # Compatibility re-exports
│   └── api/           # Modular API clients
│       ├── client.ts
│       ├── calculus.ts
│       ├── linearAlgebra.ts
│       ├── taylor.ts
│       ├── integration.ts
│       ├── multivariate.ts
│       ├── vectorField.ts
│       ├── probability.ts
│       ├── manim.ts
│       ├── solver.ts
│       └── knowledgeGraph.ts
├── components/        # Reusable UI components
├── hooks/             # Custom React hooks
└── utils/             # Utility functions
```

### Backend Structure

```
backend/app/
├── routes/
│   ├── calculus.py         # Calculus API endpoints
│   ├── linear_algebra.py   # Linear algebra API endpoints
│   ├── probability.py      # Probability & statistics endpoints
│   ├── multivariate.py     # Multivariate calculus endpoints
│   ├── vector_field.py     # Vector calculus endpoints
│   ├── manim.py            # Manim animation generation endpoints
│   ├── solver.py           # AI math problem-solving endpoints
│   └── knowledge_graph.py  # Knowledge graph endpoints
├── services/
│   ├── calculus_service.py
│   ├── linear_algebra_service.py
│   ├── probability_service.py
│   ├── multivariate_service.py
│   ├── vector_field_service.py
│   ├── manim_service.py
│   ├── manim_task_manager.py
│   ├── manim_cache.py
│   ├── manim_security.py
│   ├── solver_service.py
│   └── knowledge_graph_service.py
├── utils/
│   ├── math_utils.py       # Math expression parsing & evaluation
│   ├── response.py         # Unified API response helpers
│   ├── validation.py       # Request validation helpers
│   └── cleanup.py          # Temporary file cleanup
└── config.py               # Centralized configuration
```

## Implemented Features

| ID | Feature | Module | Status |
|----|---------|--------|--------|
| M1 | ε-δ Limit Visualization | Calculus | ✅ Done |
| M2 | Derivative Enhancement | Calculus | ✅ Done |
| M3 | Matrix Transformations | Linear Algebra | ✅ Done |
| M4 | Law of Large Numbers | Probability | ✅ Done |
| M5 | Taylor Series | Calculus | ✅ Done |
| M6 | Riemann Sums & Numerical Integration | Calculus | ✅ Done |
| M7 | Multivariate Calculus | Multivariate | ✅ Done |
| M8 | Vector Fields & Line Integrals | Vector Calculus | ✅ Done |
| M9 | Probability Distributions & CLT | Probability | ✅ Done |
| M10 | AI-Generated Manim Animation | Manim | ✅ Done |
| M11 | AI Math Problem-Solving Tutor | Solver | ✅ Done |
| M12 | Knowledge Graph / Learning Map | Knowledge Graph | ✅ Done |

## API Endpoints

### Calculus

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calculus/limit/epsilon-delta` | POST | ε-δ visualization data |
| `/api/calculus/limit/compute` | POST | Compute limit value |
| `/api/calculus/derivative/tangent` | POST | Derivative tangent line data |
| `/api/calculus/derivative/secant-approximation` | POST | Secant approximation animation |
| `/api/calculus/derivative/higher` | POST | Higher-order derivatives |
| `/api/calculus/derivative/linear-approximation` | POST | Linear approximation data |
| `/api/calculus/evaluate` | POST | Evaluate function at points |
| `/api/calculus/taylor` | POST | Taylor series data |
| `/api/calculus/taylor/evaluate` | POST | Evaluate Taylor polynomial |
| `/api/calculus/integration/riemann-sum` | POST | Riemann sum visualization |
| `/api/calculus/integration/convergence` | POST | Numerical integration convergence |

### Linear Algebra

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/linear-algebra/matrix-transform` | POST | 2×2 matrix transformation data |
| `/api/linear-algebra/matrix-presets` | GET | Preset matrix templates |

### Probability

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/probability/lln/simulate` | POST | Law of large numbers simulation |
| `/api/probability/lln/presets` | GET | LLN experiment presets |
| `/api/probability/clt/simulate` | POST | Central limit theorem simulation |
| `/api/probability/distribution/simulate` | POST | Probability distribution simulation |
| `/api/probability/distribution/presets` | GET | Distribution presets |

### Multivariate & Vector Field

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/multivariate/*` | POST/GET | Multivariate calculus APIs |
| `/api/vector-field/*` | POST/GET | Vector field & line integral APIs |

### Manim

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/manim/generate` | POST | Create animation generation task |
| `/api/manim/tasks/<id>` | GET | Query task status |
| `/api/manim/tasks/<id>/cancel` | POST | Cancel task |
| `/api/manim/tasks/<id>/code` | GET | Get generated code & render log |
| `/downloads/<filename>` | GET | Download generated video/subtitle |

### Math Problem-Solving Tutor

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/solver/analyze` | POST | Analyze a math problem and return structured solution |
| `/api/solver/hint` | POST | Get progressive hint for current step |
| `/api/solver/similar` | POST | Generate similar practice problems |

### Knowledge Graph

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge-graph` | GET | Full knowledge graph (subjects, nodes, edges) |
| `/api/knowledge-graph/concepts/<id>` | GET | Concept detail with prerequisites and next concepts |
| `/api/knowledge-graph/path?goal=<id>` | GET | Recommended learning path to a goal concept |
| `/api/knowledge-graph/related/<id>` | GET | Related visualization modules for a concept |

## Design Patterns

- Route handlers in `app/routes/` delegate to service modules
- React components use Plotly for mathematical plotting and KaTeX for formula rendering
- Math utilities in `app/utils/math_utils.py` provide safe expression parsing with whitelist validation
- `app/utils/response.py` provides unified success/error response helpers
- `app/config.py` centralizes environment variable loading

## Design Guidelines

- Use Plotly for mathematical function plotting
- Ensure responsive visualization that updates in real-time
- Support Chinese mathematical terminology and documentation
- Keep API error messages user-friendly; log full exception details on the server only
- Validate user input at the route layer and service layer when appropriate
- Use `numpy.random.default_rng(seed)` instead of global `np.random.seed()` for reproducible, thread-safe sampling
- Manim rendering tasks are limited by `ManimExecutor` with a configurable worker pool; avoid unbounded thread creation

## Security Notes

- Math expressions are parsed safely via `math_utils._safe_parse()` with AST whitelist checks
- Manim generated code is checked by `manim_security.ensure_code_safe()` before execution
- API keys must be configured via environment variables; never commit them
- Production deployment should use CORS origin restrictions and rate limiting on resource-intensive endpoints
