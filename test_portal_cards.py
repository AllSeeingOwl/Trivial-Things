"""The portal has one card per app in docker-compose.yml, on that app's port,
and every card has a colour, an icon and a description."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def compose_ports():
    text = (ROOT / "docker-compose.yml").read_text()
    pairs = re.findall(r'^  (\w+):\n(?:.*\n)*?\s+- "(\d+):', text, re.M)
    return {name: port for name, port in pairs if name != "portal"}


def test_one_card_per_app():
    html = (ROOT / "portal" / "index.html").read_text()
    card_ports = re.findall(r'class="app-card"[^>]*data-local-port="(\d+)"', html)
    assert sorted(card_ports) == sorted(compose_ports().values())


def test_cards_are_complete():
    html = (ROOT / "portal" / "index.html").read_text()
    css = (ROOT / "portal" / "styles.css").read_text()
    cards = re.findall(r'<a class="app-card" data-app="(\w+)".*?</a>', html, re.S)
    assert len(cards) == len(compose_ports())
    for block in re.findall(r'<a class="app-card".*?</a>', html, re.S):
        key = re.search(r'data-app="(\w+)"', block).group(1)
        assert f'[data-app="{key}"]' in css, f"no colour for {key}"
        assert "<svg" in block, f"no icon for {key}"
        desc = re.search(r'<p class="app-desc">([^<]+)</p>', block)
        assert desc and desc.group(1).strip(), f"no description for {key}"
