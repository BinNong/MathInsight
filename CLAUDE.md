# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathInsight is a web-based高等数学 (Advanced Mathematics) intelligent teaching assistant that provides interactive visualizations for calculus, linear algebra, and probability theory. The product aims to make abstract mathematical concepts visible and explorable through dynamic graphics and real-time computation.

**Target Users**: University professors and STEM students (freshman to junior year)

## Tech Stack

- **Frontend**: React + TypeScript, visualization libraries (Three.js / D3.js / Plotly)
- **Backend**: Python Flask or FastAPI, mathematical computation (SymPy, NumPy, SciPy, Matplotlib)
- **Testing**: Playwright for e2e tests
- **Real-time**: WebSockets or Server-Sent Events for low-latency parameter synchronization

## Development Commands

```bash
# Run the Flask application
python run.py

# Run Playwright e2e tests
npx playwright test

# Install dependencies
pip install -r requirements.txt
```

## Architecture

### Modules (from git history)

- **Calculus** (`app/routes/calculus/`): Limits, derivatives, integrals, differential equations, L'Hôpital's rule, Mean Value Theorem (Rolle/Lagrange/Cauchy)
- **Linear Algebra** (`app/routes/linear_algebra.py`): Vector spaces, matrix transformations, eigenvalues
- **Probability** (`app/routes/probability.py`): Probability distributions, statistical concepts

### Visualization Pattern

The system uses a function curve visualization component with:
- Zoom In/Out with auto-extend on zoom out
- Configurable coordinate step sizes
- Real-time graph updates as parameters change

### Service Layer Structure

- `app/services/calculus/`: Mathematical computation for calculus operations
- `app/services/linear_algebra_service.py`: Linear algebra calculations
- `app/services/probability_service.py`: Probability/statistics computations

## Key Features (from implemented commits)

- Interactive function curve visualization with zoom controls
- ε-δ limit visualization
- Derivative visualization with secant line slope limits
- Mean Value Theorem demonstrations (Rolle, Lagrange, Cauchy)
- L'Hôpital's rule module
- Coordinate step size configuration

## Design Patterns

- Route handlers in `app/routes/` delegate to service modules in `app/services/`
- Templates in `app/templates/` render mathematical visualizations
- Math utilities in `app/utils/math_utils.py` provide common functions

## Design Guidelines

- Use Plotly or similar for mathematical function plotting
- Ensure responsive visualization that updates in real-time
- Support Chinese mathematical terminology and documentation
