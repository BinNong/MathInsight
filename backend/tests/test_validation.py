import pytest
from app.utils.validation import (
    validate_request_data,
    safe_float,
    safe_int,
    safe_float_list,
    safe_bounded_float
)


class TestValidateRequestData:
    def test_valid_data(self):
        is_valid, error = validate_request_data({'x': 1}, ['x'])
        assert is_valid is True
        assert error is None

    def test_missing_field(self):
        is_valid, error = validate_request_data({'y': 1}, ['x'])
        assert is_valid is False
        assert 'Missing required field' in error

    def test_empty_data(self):
        is_valid, error = validate_request_data(None, ['x'])
        assert is_valid is False


class TestSafeFloat:
    def test_valid_float(self):
        is_valid, value = safe_float('3.14', 'x')
        assert is_valid is True
        assert abs(value - 3.14) < 1e-10

    def test_invalid_float(self):
        is_valid, error = safe_float('abc', 'x')
        assert is_valid is False
        assert 'must be a number' in error


class TestSafeInt:
    def test_valid_int(self):
        is_valid, value = safe_int('42', 'n', 1, 100)
        assert is_valid is True
        assert value == 42

    def test_out_of_range(self):
        is_valid, error = safe_int('200', 'n', 1, 100)
        assert is_valid is False
        assert 'at most' in error


class TestSafeFloatList:
    def test_valid_list(self):
        is_valid, value = safe_float_list([1, 2, 3], 'range', 3)
        assert is_valid is True
        assert value == [1.0, 2.0, 3.0]

    def test_wrong_length(self):
        is_valid, error = safe_float_list([1, 2], 'range', 3)
        assert is_valid is False
        assert 'exactly 3 elements' in error


class TestSafeBoundedFloat:
    def test_within_range(self):
        is_valid, value = safe_bounded_float(0.5, 'p', 0, 1)
        assert is_valid is True

    def test_out_of_range(self):
        is_valid, error = safe_bounded_float(1.5, 'p', 0, 1)
        assert is_valid is False
