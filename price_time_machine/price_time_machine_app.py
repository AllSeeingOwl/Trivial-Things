import os
from flask import Flask, render_template, request

app = Flask(__name__)
# Sentinel: Explicitly disable debug mode to prevent RCE vulnerabilities
app.config['DEBUG'] = False
# Sentinel: Limit upload size/payload to 1MB to prevent DoS attacks
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # Allow Tailwind CDN and inline styles (used in index.html)
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';"
    return response

# Simplified Historical CPI Data for calculation (Index values relative to base years)
# For demonstration purposes, approximated values are used here covering necessary years.
CPI_DATA = {
    "US": {2024: 314.0, 1930: 16.7, 1940: 14.0, 1950: 24.1, 1960: 29.6, 1970: 38.8, 1980: 82.4, 1989: 124.0, 1990: 130.7, 1995: 152.4, 1996: 156.9, 2000: 172.2, 2010: 218.0},
    "GB": {2024: 147.5, 1930: 1.6, 1940: 1.9, 1950: 3.0, 1960: 4.5, 1970: 6.7, 1980: 23.6, 1989: 40.5, 1990: 44.2, 1995: 53.5, 1996: 55.0, 2000: 60.7, 2010: 78.5},
    "JP": {2024: 107.0, 1930: 0.1, 1940: 0.3, 1950: 11.2, 1960: 17.5, 1970: 31.8, 1980: 68.6, 1989: 81.3, 1990: 83.8, 1995: 88.0, 1996: 88.1, 2000: 88.6, 2010: 86.4},
    "CH": {2024: 106.5, 1930: 18.0, 1940: 20.0, 1950: 22.4, 1960: 25.1, 1970: 34.6, 1980: 52.8, 1989: 66.0, 1990: 70.3, 1995: 80.0, 1996: 80.6, 2000: 82.5, 2010: 90.0},
    "AU": {2024: 136.0, 1930: 3.5, 1940: 4.0, 1950: 6.5, 1960: 11.4, 1970: 14.3, 1980: 36.0, 1989: 76.0, 1990: 81.5, 1995: 90.0, 1996: 92.0, 2000: 100.0, 2010: 130.0}
}

REGIONS = {
    "US": {"name": "United States", "currency": "$", "code": "USD"},
    "GB": {"name": "United Kingdom", "currency": "£", "code": "GBP"},
    "JP": {"name": "Japan", "currency": "¥", "code": "JPY"},
    "CH": {"name": "Switzerland", "currency": "CHF", "code": "CHF"},
    "AU": {"name": "Australia", "currency": "$", "code": "AUD"}
}

# Global items (available everywhere, priced locally)
GLOBAL_ITEMS = [
    {"id": "game_boy", "name": "Nintendo Game Boy", "emoji": "👾", "year": 1989, "prices": {"US": 89.99, "GB": 69.99, "JP": 12500, "CH": 149.0, "AU": 119.0}},
    {"id": "n64", "name": "Nintendo 64", "emoji": "🎮", "year": 1996, "prices": {"US": 199.99, "GB": 249.99, "JP": 25000, "CH": 399.0, "AU": 399.0}},
    {"id": "coffee", "name": "Cup of Coffee", "emoji": "☕", "year": 1980, "prices": {"US": 0.45, "GB": 0.35, "JP": 250, "CH": 1.20, "AU": 0.60}},
    {"id": "cinema", "name": "Movie Ticket", "emoji": "🎟️", "year": 1990, "prices": {"US": 4.22, "GB": 2.50, "JP": 1600, "CH": 10.0, "AU": 5.00}},
    {"id": "milk", "name": "Gallon of Milk (approx)", "emoji": "🥛", "year": 1970, "prices": {"US": 1.15, "GB": 0.30, "JP": 350, "CH": 1.50, "AU": 0.70}},
    {"id": "jeans", "name": "Pair of Jeans", "emoji": "👖", "year": 1980, "prices": {"US": 14.00, "GB": 12.00, "JP": 3500, "CH": 25.0, "AU": 15.00}},
    {"id": "car", "name": "New Family Car", "emoji": "🚗", "year": 1995, "prices": {"US": 15500, "GB": 10000, "JP": 1500000, "CH": 20000, "AU": 18000}},
    {"id": "home", "name": "Average Home", "emoji": "🏠", "year": 1970, "prices": {"US": 23400, "GB": 4500, "JP": 8000000, "CH": 90000, "AU": 18000}},
    {"id": "burger", "name": "Fast Food Burger", "emoji": "🍔", "year": 1960, "prices": {"US": 0.20, "GB": 0.10, "JP": 60, "CH": 0.80, "AU": 0.25}},
    {"id": "stamp", "name": "Postage Stamp", "emoji": "✉️", "year": 1980, "prices": {"US": 0.15, "GB": 0.12, "JP": 60, "CH": 0.40, "AU": 0.22}},
]

# Localized items specific to regions
LOCAL_ITEMS = {
    "US": [
        {"name": "Baseball Glove", "emoji": "⚾", "year": 1950, "price": 4.50},
        {"name": "Apple Macintosh", "emoji": "🖥️", "year": 1984, "price": 2495.00},
        {"name": "New York Times", "emoji": "📰", "year": 1960, "price": 0.05},
        {"name": "Jukebox Play", "emoji": "🎵", "year": 1950, "price": 0.05},
        {"name": "Drive-in Movie", "emoji": "🍿", "year": 1960, "price": 1.00}
    ],
    "GB": [
        {"name": "Fish and Chips", "emoji": "🍟", "year": 1970, "price": 0.15},
        {"name": "Pint of Bitter", "native_name": "Pint", "emoji": "🍺", "year": 1980, "price": 0.35},
        {"name": "Sinclair ZX Spectrum", "emoji": "⌨️", "year": 1982, "price": 125.00},
        {"name": "London Tube Ticket", "emoji": "🚇", "year": 1970, "price": 0.05},
        {"name": "BBC TV Licence", "emoji": "📺", "year": 1980, "price": 34.00}
    ],
    "JP": [
        {"name": "Manga Magazine", "native_name": "Manga (漫画)", "emoji": "📚", "year": 1980, "price": 150},
        {"name": "Bowl of Ramen", "native_name": "Ramen (ラーメン)", "emoji": "🍜", "year": 1970, "price": 100},
        {"name": "Sony Walkman", "emoji": "🎧", "year": 1979, "price": 33000},
        {"name": "Shinkansen Ticket", "native_name": "Shinkansen (新幹線)", "emoji": "🚄", "year": 1964, "price": 2480},
        {"name": "Rice Cooker", "native_name": "Suihanki (炊飯器)", "emoji": "🍚", "year": 1955, "price": 3200}
    ],
    "CH": [
        {"name": "Swiss Chocolate Bar", "native_name": "Schoggi", "emoji": "🍫", "year": 1960, "price": 0.80},
        {"name": "Victorinox Army Knife", "native_name": "Sackmesser", "emoji": "🔪", "year": 1980, "price": 15.00},
        {"name": "Ski Lift Pass (Day)", "native_name": "Tageskarte", "emoji": "⛷️", "year": 1970, "price": 20.00},
        {"name": "Fondue Set", "native_name": "Caquelon", "emoji": "🫕", "year": 1980, "price": 45.00},
        {"name": "Rolex Submariner", "emoji": "⌚", "year": 1960, "price": 600.00}
    ],
    "AU": [
        {"name": "Jar of Vegemite", "emoji": "🍞", "year": 1970, "price": 0.45},
        {"name": "Meat Pie", "emoji": "🥧", "year": 1980, "price": 0.60},
        {"name": "Holden Commodore", "emoji": "🚙", "year": 1978, "price": 6513.00},
        {"name": "Surfboard", "emoji": "🏄", "year": 1970, "price": 120.00},
        {"name": "Pair of Thongs", "native_name": "Thongs", "emoji": "🩴", "year": 1980, "price": 2.50}
    ]
}

def calculate_inflation(region_code, year, historical_price):
    """Calculates modern price using CPI."""
    # Find closest available year in CPI data if exact doesn't exist (fallback)
    cpi_region = CPI_DATA.get(region_code, CPI_DATA["US"])

    # We need CPI for 2024 and for the historical year
    cpi_now = cpi_region.get(2024, 1.0)

    # Find the nearest year in our CPI dataset
    available_years = sorted(cpi_region.keys())
    nearest_year = min(available_years, key=lambda x: abs(x - year))
    cpi_then = cpi_region.get(nearest_year, 1.0)

    # Avoid division by zero
    if cpi_then == 0:
        cpi_then = 1.0

    modern_price = historical_price * (cpi_now / cpi_then)
    return modern_price, cpi_now / cpi_then

@app.route('/')
def index():
    region_code = request.args.get('region', 'US').upper()
    if region_code not in REGIONS:
        region_code = 'US'

    region_info = REGIONS[region_code]

    display_items = []

    # Add Global Items
    for g_item in GLOBAL_ITEMS:
        # Check if item exists in this region, else skip or default
        if region_code in g_item["prices"]:
            hist_price = g_item["prices"][region_code]
            mod_price, multiplier = calculate_inflation(region_code, g_item["year"], hist_price)

            display_items.append({
                "name": g_item["name"],
                "emoji": g_item["emoji"],
                "historical_year": g_item["year"],
                "historical_price": hist_price,
                "modern_price": mod_price,
                "multiplier": multiplier
            })

    # Add Local Items
    for l_item in LOCAL_ITEMS.get(region_code, []):
        mod_price, multiplier = calculate_inflation(region_code, l_item["year"], l_item["price"])
        name = l_item["name"]
        if "native_name" in l_item:
            name = f"{name} ({l_item['native_name']})"

        display_items.append({
            "name": name,
            "emoji": l_item["emoji"],
            "historical_year": l_item["year"],
            "historical_price": l_item["price"],
            "modern_price": mod_price,
            "multiplier": multiplier
        })

    return render_template('index.html',
                           items=display_items,
                           regions=REGIONS,
                           current_region=region_code,
                           currency=region_info["currency"])

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    app.run(debug=False, port=port, host=host)
