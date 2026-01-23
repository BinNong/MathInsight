# Taylor Series Visualization Design

**Date**: 2026-01-22

## 1. Overview

A visualization tool to help students understand how Taylor polynomials approximate functions.

## 2. Requirements

- **Core Goal**: Demonstrate polynomial approximation of functions
- **Presets**: sin(x), cos(x), e^x, ln(1+x), (1+x)^n + custom input
- **Controls**: Slider + input box for x₀ (expansion point) and n (order)
- **Display**: Overlay all orders + single order view
- **Location**: Calculus module, alongside derivative page

## 3. API Design

### Endpoint
```
POST /api/calculus/taylor/visualize
```

### Request
```json
{
  "func_str": "sin(x)",
  "x0": 0,
  "max_order": 5
}
```

### Response
```json
{
  "func": { "x": [...], "y": [...], "label": "sin(x)" },
  "polynomials": [
    { "order": 1, "x": [...], "y": [...], "label": "P₁(x)" },
    { "order": 2, "x": [...], "y": [...], "label": "P₂(x)" },
    ...
  ],
  "x0": 0,
  "x_range": [-10, 10]
}
```

## 4. Frontend Components

- **Function Selector**: Dropdown presets + custom input
- **x₀ Control**: Slider [-5, 5] + input box
- **Order Control**: Slider [1, 10] + input box
- **View Toggle**: Checkbox for overlay mode
- **Plotly Chart**: Multi-line chart with legend

## 5. Backend Implementation

1. Use SymPy's `series()` to compute Taylor polynomials
2. Convert symbolic expressions to numerical data
3. Return all orders up to max_order

## 6. Files to Modify/Create

- `backend/app/routes/calculus.py` - Add route
- `backend/app/services/calculus_service.py` - Add service
- `frontend/src/pages/TaylorSeries.tsx` - New page
- `frontend/src/services/api.ts` - Add API call

## 7. Preset Functions

| Function | Taylor Series at x₀=0 |
|----------|----------------------|
| sin(x) | x - x³/3! + x⁵/5! - ... |
| cos(x) | 1 - x²/2! + x⁴/4! - ... |
| e^x | 1 + x + x²/2! + x³/3! + ... |
| ln(1+x) | x - x²/2 + x³/3 - ... |
| (1+x)^n | 1 + nx + n(n-1)x²/2! + ... |
