import math

import numpy as np
import pytest

from app.services.vector_field_service import VectorFieldService


def _gauss_theorem(p, q, r, solid_type, solid_params, resolution):
    result = VectorFieldService.verify_gauss_theorem(
        p, q, r, solid_type, solid_params, resolution=resolution
    )
    assert result['success'], result.get('error')
    return result['gauss_theorem']


def test_unit_sphere_radial_flux_respects_orientation():
    outward = VectorFieldService.compute_surface_integral(
        'x', 'y', 'z', 'sphere', {'r': 1}, orientation='outward', resolution=64
    )
    inward = VectorFieldService.compute_surface_integral(
        'x', 'y', 'z', 'sphere', {'r': 1}, orientation='inward', resolution=64
    )

    assert outward['success'], outward.get('error')
    assert inward['success'], inward.get('error')
    assert outward['surface_integral'] == pytest.approx(4 * math.pi, abs=5e-3)
    assert inward['surface_integral'] == pytest.approx(-4 * math.pi, abs=5e-3)
    assert inward['surface_integral'] == pytest.approx(-outward['surface_integral'], abs=1e-12)


def test_constant_field_has_zero_net_flux_through_closed_sphere():
    result = VectorFieldService.compute_surface_integral(
        '1', '-2', '3', 'sphere', {'r': 1}, resolution=32
    )

    assert result['success'], result.get('error')
    assert result['surface_integral'] == pytest.approx(0, abs=1e-10)


def test_odd_divergence_integrates_to_zero_over_symmetric_sphere():
    theorem = _gauss_theorem('x**2', '0', '0', 'sphere', {'r': 1}, resolution=20)

    assert theorem['divergence_expression'] == '2*x'
    assert theorem['surface_integral']['value'] == pytest.approx(0, abs=1e-10)
    assert theorem['volume_integral']['value'] == pytest.approx(0, abs=1e-10)


def test_cube_flux_and_divergence_integral_match_analytic_value():
    theorem = _gauss_theorem('x', 'y', 'z', 'cube', {'half': 1.5}, resolution=12)
    expected = 24 * 1.5**3

    assert theorem['surface_integral']['value'] == pytest.approx(expected, abs=1e-9)
    assert theorem['volume_integral']['value'] == pytest.approx(expected, abs=1e-8)


def test_cylinder_flux_and_divergence_integral_match_analytic_value():
    theorem = _gauss_theorem(
        'x', 'y', 'z', 'cylinder', {'r': 2, 'h': 3}, resolution=20
    )
    expected = 3 * math.pi * 2**2 * 3

    assert theorem['surface_integral']['value'] == pytest.approx(expected, rel=1e-8)
    assert theorem['volume_integral']['value'] == pytest.approx(expected, rel=1e-6)


def test_cylinder_volume_integral_preserves_coordinate_order():
    theorem = _gauss_theorem(
        'x**3/3', '0', 'z**2/2', 'cylinder', {'r': 2, 'h': 3}, resolution=20
    )
    expected = math.pi * 2**4 * 3 / 4

    assert theorem['divergence_expression'] == 'x**2 + z'
    assert theorem['surface_integral']['value'] == pytest.approx(expected, rel=1e-8)
    assert theorem['volume_integral']['value'] == pytest.approx(expected, rel=1e-6)


def test_backward_streamline_follows_negative_time_solution_and_tangent():
    result = VectorFieldService.compute_streamline(
        '-y', 'x', [(1.0, 0.0)], (-math.pi / 2, 0), direction='backward'
    )

    assert result['success'], result.get('error')
    path = result['streamlines'][0]
    x = np.asarray(path['x'])
    y = np.asarray(path['y'])
    assert len(x) == len(y) == 50
    assert x[0] == pytest.approx(0, abs=1e-5)
    assert y[0] == pytest.approx(-1, abs=1e-5)
    assert x[-1] == pytest.approx(1, abs=1e-12)
    assert y[-1] == pytest.approx(0, abs=1e-12)
    assert np.allclose(x**2 + y**2, 1, atol=1e-5)

    delta = (math.pi / 2) / (len(x) - 1)
    secant = np.array([x[-1] - x[-2], y[-1] - y[-2]])
    secant /= np.linalg.norm(secant)
    expected_tangent = np.array([math.sin(delta / 2), math.cos(delta / 2)])
    assert secant == pytest.approx(expected_tangent, abs=1e-5)
