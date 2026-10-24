import math

import pytest

from app.services.linear_algebra_service import LinearAlgebraService


class TestLinearAlgebraServiceMatrixTransform:
    def test_scale_matrix_determinant(self):
        result = LinearAlgebraService.matrix_transform(
            a=2, b=0, c=0, d=2,
            show_eigenvectors=True
        )
        assert abs(result.determinant['value'] - 4.0) < 1e-10
        assert '面积缩放 4.00 倍' in result.determinant['interpretation']

    def test_identity_matrix(self):
        result = LinearAlgebraService.matrix_transform(
            a=1, b=0, c=0, d=1
        )
        assert abs(result.determinant['value'] - 1.0) < 1e-10

    def test_singular_matrix(self):
        result = LinearAlgebraService.matrix_transform(
            a=1, b=1, c=1, d=1
        )
        assert abs(result.determinant['value']) < 1e-10
        assert '降维' in result.determinant['interpretation']

    def test_rotation_matrix_complex_eigenvalues(self):
        # 90 度旋转矩阵，特征值为纯虚数
        result = LinearAlgebraService.matrix_transform(
            a=0, b=-1, c=1, d=0
        )
        assert result.eigenvectors is None
        # 特征值应为复数
        for ev in result.eigenvalues:
            if isinstance(ev, dict):
                assert 're' in ev and 'im' in ev
            else:
                assert isinstance(ev, complex)

    def test_reflection_matrix_real_eigenvalues(self):
        # 沿 x 轴反射，特征值为 1 和 -1
        result = LinearAlgebraService.matrix_transform(
            a=1, b=0, c=0, d=-1
        )
        real_eigenvalues = []
        for ev in result.eigenvalues:
            if isinstance(ev, (int, float)):
                real_eigenvalues.append(ev)
            elif isinstance(ev, dict) and abs(ev['im']) < 1e-10:
                real_eigenvalues.append(ev['re'])
        assert len(real_eigenvalues) == 2
        assert any(abs(ev - 1.0) < 1e-10 for ev in real_eigenvalues)
        assert any(abs(ev + 1.0) < 1e-10 for ev in real_eigenvalues)

    def test_unit_grid_structure(self):
        result = LinearAlgebraService.matrix_transform(
            a=1, b=0, c=0, d=1
        )
        assert 'x_horizontal' in result.unit_grid
        assert 'x_vertical' in result.unit_grid
        assert 'y_horizontal' in result.unit_grid
        assert 'y_vertical' in result.unit_grid
        assert len(result.unit_grid['x_horizontal']) == LinearAlgebraService.GRID_LINES

    def test_unit_circle_structure(self):
        result = LinearAlgebraService.matrix_transform(
            a=2, b=0, c=0, d=2
        )
        assert 'x' in result.unit_circle
        assert 'y' in result.unit_circle
        assert len(result.unit_circle['x']) == LinearAlgebraService.CIRCLE_POINTS


class TestLinearAlgebraServicePresets:
    def test_presets_contain_common_transforms(self):
        presets = LinearAlgebraService.get_presets()
        assert 'identity' in presets
        assert 'scale_2' in presets
        assert 'rotate_45' in presets
        assert 'shear_x' in presets
        for key, preset in presets.items():
            assert 'a' in preset
            assert 'b' in preset
            assert 'c' in preset
            assert 'd' in preset
