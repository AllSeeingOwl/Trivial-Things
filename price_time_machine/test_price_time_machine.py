import pytest
from price_time_machine_app import app, calculate_inflation

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index_default_region(client):
    """Test that the index route loads the default US region."""
    response = client.get('/')
    assert response.status_code == 200
    # Should contain US currency symbol and default items
    html = response.data.decode('utf-8')
    assert '<title>Price Time Machine' in html
    assert 'United States ($)' in html
    assert 'Nintendo Game Boy' in html
    assert 'Baseball Glove' in html # US local item

def test_index_gb_region(client):
    """Test that the index route handles the region query parameter."""
    response = client.get('/?region=GB')
    assert response.status_code == 200
    html = response.data.decode('utf-8')
    assert 'United Kingdom (£)' in html
    assert 'Nintendo Game Boy' in html # Global
    assert 'Fish and Chips' in html # GB local item
    assert 'Baseball Glove' not in html # US local should be absent

def test_index_jp_region(client):
    """Test region switching to Japan, checking native names."""
    response = client.get('/?region=JP')
    assert response.status_code == 200
    html = response.data.decode('utf-8')
    assert 'Japan (¥)' in html
    assert 'Manga Magazine (Manga (漫画))' in html # JP local item

def test_invalid_region_fallback(client):
    """Test that an invalid region falls back to US."""
    response = client.get('/?region=INVALID')
    assert response.status_code == 200
    html = response.data.decode('utf-8')
    assert 'United States ($)' in html

def test_calculate_inflation_logic():
    """Test the dynamic inflation mathematical logic."""
    # Based on our mock data for US:
    # 2024 CPI = 314.0
    # 1980 CPI = 82.4
    # Multiplier should be approx 314.0 / 82.4 = 3.810679...
    modern, multiplier = calculate_inflation('US', 1980, 10.0)

    assert abs(multiplier - 3.81) < 0.01
    assert abs(modern - 38.10) < 0.1

def test_calculate_inflation_fallback_year():
    """Test that the nearest year is selected when exact year is missing."""
    # US dataset has 1980 and 1989. For 1982, nearest is 1980 (difference 2 vs 7)
    # Using 1980 CPI (82.4)
    modern_1982, mult_1982 = calculate_inflation('US', 1982, 10.0)
    modern_1980, mult_1980 = calculate_inflation('US', 1980, 10.0)

    assert mult_1982 == mult_1980
