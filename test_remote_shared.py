"""The shared phone remote (shared/remote/remote.py), tested with a small dummy game.
Each app's own tests cover what its TV may and may not see."""
import sys
from pathlib import Path

import pytest
from flask import Flask

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "shared" / "remote"))
import remote  # noqa: E402


class SecretGame:
    def new_state(self):
        return {"secret": "swordfish", "shown": False}

    def display_view(self, state):
        return {"shown": state["shown"], "secret": state["secret"] if state["shown"] else None}

    def host_view(self, state):
        return dict(state)

    def act(self, state, action, data):
        if action == "show":
            state["shown"] = True
        else:
            raise remote.RoomError("Unknown action.")


@pytest.fixture
def client(tmp_path):
    app = Flask(__name__, template_folder=str(tmp_path))
    (tmp_path / "host.html").write_text("phone page")
    remote.add_remote_routes(app, remote.RoomStore(SecretGame()))
    return app.test_client()


def start(client):
    res = client.post("/api/rooms")
    assert res.status_code == 201
    body = res.get_json()
    assert len(body["code"]) == 4 and body["token"]
    assert body["state"]["secret"] == "swordfish"
    return body["code"], {"X-Host-Token": body["token"]}


def test_display_hides_what_the_game_hides_until_shown(client):
    code, host = start(client)
    assert "swordfish" not in client.get(f"/api/rooms/{code}").get_data(as_text=True)
    assert client.post(f"/api/rooms/{code}/actions", json={"action": "show"}, headers=host).status_code == 200
    assert client.get(f"/api/rooms/{code}").get_json()["secret"] == "swordfish"


def test_only_the_host_can_act_or_see_the_host_view(client):
    code, _ = start(client)
    for headers in ({}, {"X-Host-Token": "nope"}):
        assert client.post(f"/api/rooms/{code}/actions", json={"action": "show"}, headers=headers).status_code == 403
        assert client.get(f"/api/rooms/{code}/host", headers=headers).status_code == 403


def test_refused_actions_and_bad_bodies(client):
    code, host = start(client)
    res = client.post(f"/api/rooms/{code}/actions", json={"action": "explode"}, headers=host)
    assert res.status_code == 400 and res.get_json()["error"] == "Unknown action."
    assert client.post(f"/api/rooms/{code}/actions", data="x", headers=host).status_code == 400


def test_versions_codes_and_caching(client):
    code, host = start(client)
    v0 = client.get(f"/api/rooms/{code}").get_json()["version"]
    client.post(f"/api/rooms/{code}/actions", json={"action": "show"}, headers=host)
    res = client.get(f"/api/rooms/{code.lower()}")
    assert res.get_json()["version"] == v0 + 1
    assert res.headers["Cache-Control"] == "no-store"
    assert client.get("/api/rooms/ZZ1Z").status_code == 404
    assert client.get("/host").get_data(as_text=True) == "phone page"


def test_idle_rooms_expire_and_the_cap_holds(monkeypatch):
    clock = [1000.0]
    store = remote.RoomStore(SecretGame(), now=lambda: clock[0])
    room = store.create()
    clock[0] += remote.ROOM_TTL_SECONDS + 1
    assert store.get(room.code) is None
    monkeypatch.setattr(remote, "MAX_ROOMS", 2)
    store.create()
    store.create()
    with pytest.raises(remote.RoomsFull):
        store.create()
