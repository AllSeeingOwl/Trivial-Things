"""Checks for the Sentry setup shared by the Flask apps."""
import importlib.util
import pathlib
import sys
import types
from unittest import mock

ROOT = pathlib.Path(__file__).parent
APPS = {
    "interactive_scoreboard": "scoreboard_app.py",
    "mcq_flashcards": "mcq_flashcards_app.py",
    "pdf_grid_flashcards": "pdf_grid_flashcards_app.py",
    "periodic_name": "periodic_name_app.py",
    "point_it_out": "point_it_out_app.py",
    "price_time_machine": "price_time_machine_app.py",
    "quarterly_calendar": "quarterly_calendar_app.py",
    "sliding_rows_flashcards": "sliding_rows_flashcards_app.py",
    "trivia_flashcards": "trivia_flashcards_app.py",
    "tv_link": "tv_link_app.py",
    "what_the_spell": "what_the_spell_app.py",
    "where_in_the_world": "where_in_the_world_app.py",
    "whovian_degrees": "whovian_degrees_app.py",
}


def load_setup(app_dir):
    spec = importlib.util.spec_from_file_location(f"sentry_setup_{app_dir}", ROOT / app_dir / "sentry_setup.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_every_app_has_an_identical_copy():
    reference = (ROOT / "periodic_name" / "sentry_setup.py").read_text()
    for app_dir in APPS:
        assert (ROOT / app_dir / "sentry_setup.py").read_text() == reference, app_dir


def test_every_app_starts_sentry_before_creating_flask_and_requires_the_sdk():
    for app_dir, app_file in APPS.items():
        source = (ROOT / app_dir / app_file).read_text()
        call = f'init_sentry("{app_dir}")'
        assert call in source, app_dir
        assert source.index(call) < source.index("app = Flask(__name__)"), app_dir
        assert "sentry-sdk[flask]" in (ROOT / app_dir / "requirements.txt").read_text(), app_dir


def test_sentry_stays_off_without_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    fake_sdk = types.SimpleNamespace(init=mock.Mock(), set_tag=mock.Mock())
    with mock.patch.dict(sys.modules, {"sentry_sdk": fake_sdk}):
        assert load_setup("periodic_name").init_sentry("periodic_name") is False
    fake_sdk.init.assert_not_called()


def test_sentry_collects_no_personal_data_and_tags_the_app(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "https://key@o1.ingest.de.sentry.io/1")
    fake_sdk = types.SimpleNamespace(init=mock.Mock(), set_tag=mock.Mock())
    with mock.patch.dict(sys.modules, {"sentry_sdk": fake_sdk}):
        assert load_setup("mcq_flashcards").init_sentry("mcq_flashcards") is True

    kwargs = fake_sdk.init.call_args.kwargs
    data = kwargs["data_collection"]
    assert data["user_info"] is False
    assert data["http_bodies"] == []
    assert data["stack_frame_variables"] is False
    assert data["cookies"] == {"mode": "off"}
    assert data["url_query_params"] == {"mode": "off"}
    assert data["http_headers"] == {"request": {"mode": "off"}}
    assert "send_default_pii" not in kwargs
    fake_sdk.set_tag.assert_called_once_with("app", "mcq_flashcards")
