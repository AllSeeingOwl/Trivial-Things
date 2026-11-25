"""TV Link: a TV gets a code, phones join with it and control what the TV shows."""
import pytest

try:
    import screens as screens_mod
    import tv_link_app
except ModuleNotFoundError:
    from tv_link import screens as screens_mod
    from tv_link import tv_link_app

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


class Clock:
    def __init__(self):
        self.t = 1_000_000.0

    def __call__(self):
        return self.t


@pytest.fixture
def clock(monkeypatch):
    clock = Clock()
    monkeypatch.setattr(tv_link_app, "SCREENS", screens_mod.ScreenStore(now=clock))
    return clock


@pytest.fixture
def client(clock):
    tv_link_app.app.config["TESTING"] = True
    return tv_link_app.app.test_client()


def new_tv(client):
    res = client.post("/api/screens")
    assert res.status_code == 201
    body = res.get_json()
    assert len(body["code"]) == screens_mod.CODE_LENGTH and body["code"].isalpha()
    return body["code"], {"X-TV-Token": body["tv_token"]}


def join(client, code):
    res = client.post(f"/api/screens/{code}/join")
    assert res.status_code == 200, res.get_json()
    return {"X-Phone-Token": res.get_json()["token"]}


def act(client, code, phone, **data):
    return client.post(f"/api/screens/{code}/actions", json=data, headers=phone)


def tv_state(client, code, tv):
    res = client.get(f"/api/screens/{code}/tv", headers=tv)
    assert res.status_code == 200
    return res.get_json()


# --- pages ---------------------------------------------------------------------------------

def test_pages_load(client):
    for path in ("/", "/tv"):
        res = client.get(path)
        assert res.status_code == 200
        assert "script-src 'self'" in res.headers["Content-Security-Policy"]


def test_only_the_tv_page_may_embed_youtube(client):
    assert "frame-src https://www.youtube-nocookie.com" in client.get("/tv").headers["Content-Security-Policy"]
    assert "frame-src 'none'" in client.get("/").headers["Content-Security-Policy"]


def test_qr_code_links_to_the_phone_page_with_the_code(client):
    pytest.importorskip("segno")
    code, _ = new_tv(client)
    res = client.get(f"/qr.svg?code={code}")
    assert res.status_code == 200
    assert res.mimetype == "image/svg+xml"
    assert client.get("/qr.svg?code=bad").status_code == 404


# --- connecting ----------------------------------------------------------------------------

def test_phone_joins_with_the_code_in_any_case(client):
    code, tv = new_tv(client)
    phone = join(client, " " + code.lower() + " ")
    assert client.get(f"/api/screens/{code}/state", headers=phone).status_code == 200
    assert tv_state(client, code, tv)["phones"] == 1


def test_wrong_code_and_tokens_are_refused(client):
    code, tv = new_tv(client)
    assert client.post("/api/screens/ZZZZZ/join").status_code in (404, 200)  # 200 only if it's really ZZZZZ
    assert client.get(f"/api/screens/{code}/state", headers={"X-Phone-Token": "nope"}).status_code == 403
    assert client.get(f"/api/screens/{code}/tv", headers={"X-TV-Token": "nope"}).status_code == 403
    # A phone's token isn't the TV's.
    phone = join(client, code)
    assert client.get(f"/api/screens/{code}/tv", headers={"X-TV-Token": phone["X-Phone-Token"]}).status_code == 403
    assert act(client, code, {}, action="clock").status_code == 403


def test_guessing_codes_is_slowed_down(client):
    for _ in range(screens_mod.JOIN_FAILURES_ALLOWED):
        client.post("/api/screens/QQQQQ/join")
    code, _ = new_tv(client)
    assert client.post(f"/api/screens/{code}/join").status_code == 429


def test_new_code_on_the_tv_disconnects_phones(client):
    code, tv = new_tv(client)
    phone = join(client, code)
    assert client.post(f"/api/screens/{code}/tv/end", headers=phone).status_code == 403
    assert client.post(f"/api/screens/{code}/tv/end", headers=tv).status_code == 200
    assert client.get(f"/api/screens/{code}/state", headers=phone).status_code == 404


def test_screen_ends_when_the_tv_stops_checking_in(client, clock):
    code, tv = new_tv(client)
    phone = join(client, code)
    clock.t += screens_mod.SCREEN_TTL_SECONDS - 5
    tv_state(client, code, tv)  # the TV polling keeps it alive
    clock.t += screens_mod.SCREEN_TTL_SECONDS - 5
    assert client.get(f"/api/screens/{code}/state", headers=phone).status_code == 200
    clock.t += screens_mod.SCREEN_TTL_SECONDS + 1
    assert client.get(f"/api/screens/{code}/state", headers=phone).status_code == 404


# --- what the TV shows ---------------------------------------------------------------------

def test_simple_screens(client):
    code, tv = new_tv(client)
    phone = join(client, code)
    assert tv_state(client, code, tv)["mode"] == "home"
    for mode in ("clock", "blank", "home"):
        assert act(client, code, phone, action=mode).status_code == 200
        assert tv_state(client, code, tv)["mode"] == mode
    assert act(client, code, phone, action="nonsense").status_code == 400
    assert act(client, code, phone, action="_prune").status_code == 400


def test_message(client):
    code, tv = new_tv(client)
    phone = join(client, code)
    assert act(client, code, phone, action="message", text="  Dinner's ready!  ").status_code == 200
    state = tv_state(client, code, tv)
    assert state["mode"] == "message" and state["content"]["text"] == "Dinner's ready!"
    assert act(client, code, phone, action="message", text=" ").status_code == 400
    assert act(client, code, phone, action="message", text="x" * 281).status_code == 400


def test_photos_upload_show_step_and_remove(client):
    code, tv = new_tv(client)
    phone = join(client, code)
    ids = []
    for i, data in enumerate([JPEG, PNG, JPEG]):
        res = client.post(f"/api/screens/{code}/photos" + ("?show=1" if i == 0 else ""), data=data,
                          headers=dict(phone, **{"Content-Type": "image/jpeg"}))
        assert res.status_code == 201, res.get_json()
        ids.append(res.get_json()["photo"])
    state = tv_state(client, code, tv)
    assert state["photos"] == ids
    assert state["mode"] == "photo" and state["content"]["index"] == 0

    img = client.get(f"/api/screens/{code}/photos/{ids[1]}")
    assert img.status_code == 200 and img.mimetype == "image/png" and img.data == PNG
    assert client.get(f"/api/screens/{code}/photos/not-a-photo").status_code == 404

    act(client, code, phone, action="step_photo", delta=-1)
    assert tv_state(client, code, tv)["content"]["index"] == 2
    act(client, code, phone, action="step_photo", delta=1)
    assert tv_state(client, code, tv)["content"]["index"] == 0
    act(client, code, phone, action="show_photo", photo=ids[2])
    assert tv_state(client, code, tv)["content"]["index"] == 2

    # Removing an earlier photo keeps the same one on screen.
    act(client, code, phone, action="remove_photo", photo=ids[0])
    state = tv_state(client, code, tv)
    assert state["photos"] == ids[1:] and state["content"]["index"] == 1
    assert client.get(f"/api/screens/{code}/photos/{ids[0]}").status_code == 404
    for photo in ids[1:]:
        act(client, code, phone, action="remove_photo", photo=photo)
    assert tv_state(client, code, tv)["mode"] == "home"


def test_only_photos_the_tv_can_show_are_accepted(client):
    code, _ = new_tv(client)
    phone = join(client, code)
    for data in (b"<svg></svg>", b"RIFF\x00\x00\x00\x00WEBPVP8 ", b""):
        assert client.post(f"/api/screens/{code}/photos", data=data, headers=phone).status_code == 400
    assert client.post(f"/api/screens/{code}/photos", data=JPEG).status_code == 403


def test_photo_limits(client, monkeypatch):
    monkeypatch.setattr(screens_mod, "MAX_PHOTOS_PER_SCREEN", 2)
    code, _ = new_tv(client)
    phone = join(client, code)
    for _ in range(2):
        assert client.post(f"/api/screens/{code}/photos", data=JPEG, headers=phone).status_code == 201
    res = client.post(f"/api/screens/{code}/photos", data=JPEG, headers=phone)
    assert res.status_code == 400 and "already has" in res.get_json()["error"]


def test_slideshow_moves_on_by_itself(client, clock):
    code, tv = new_tv(client)
    phone = join(client, code)
    assert act(client, code, phone, action="slideshow", seconds=5).status_code == 400  # no photos yet
    for _ in range(3):
        client.post(f"/api/screens/{code}/photos", data=JPEG, headers=phone)
    assert act(client, code, phone, action="slideshow", seconds=7).status_code == 400
    act(client, code, phone, action="slideshow", seconds=5)
    state = tv_state(client, code, tv)
    assert state["content"]["slideshow"] == 5
    clock.t += 11  # two slides on: the third photo
    act(client, code, phone, action="step_photo", delta=1)
    content = tv_state(client, code, tv)["content"]
    assert content["index"] == 0 and content["slideshow"] == 5  # wrapped round, still running
    act(client, code, phone, action="slideshow", seconds=0)
    assert tv_state(client, code, tv)["content"]["slideshow"] == 0


def test_youtube_links(client):
    code, tv = new_tv(client)
    phone = join(client, code)
    assert act(client, code, phone, action="video", url="https://youtu.be/dQw4w9WgXcQ?t=42").status_code == 200
    content = tv_state(client, code, tv)["content"]
    assert content["youtube"] == "dQw4w9WgXcQ" and content["start"] == 42 and content["playing"]
    act(client, code, phone, action="video_pause")
    act(client, code, phone, action="video_mute", muted=True)
    content = tv_state(client, code, tv)["content"]
    assert not content["playing"] and content["muted"] and content["command"] == 2
    act(client, code, phone, action="home")
    assert act(client, code, phone, action="video_play").status_code == 400
    assert act(client, code, phone, action="video", url="https://example.com/watch?v=dQw4w9WgXcQ").status_code == 400


@pytest.mark.parametrize("url, expected", [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", ("dQw4w9WgXcQ", 0)),
    ("youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", ("dQw4w9WgXcQ", 90)),
    ("https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", ("dQw4w9WgXcQ", 0)),
    ("https://youtube.com/shorts/dQw4w9WgXcQ?si=abc", ("dQw4w9WgXcQ", 0)),
    ("https://www.youtube.com/live/dQw4w9WgXcQ", ("dQw4w9WgXcQ", 0)),
    ("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=10", ("dQw4w9WgXcQ", 10)),
    ("dQw4w9WgXcQ", ("dQw4w9WgXcQ", 0)),
    ("https://youtu.be/short", None),
    ("https://evil.example/youtu.be/dQw4w9WgXcQ", None),
    ("javascript:alert(1)", None),
    ("", None),
])
def test_parse_youtube(url, expected):
    assert screens_mod.parse_youtube(url) == expected


def test_timer_pause_resume_and_add(client, clock):
    code, tv = new_tv(client)
    phone = join(client, code)
    for bad in (0, -5, "60", True, 25 * 3600):
        assert act(client, code, phone, action="timer", seconds=bad).status_code == 400
    assert act(client, code, phone, action="timer_pause").status_code == 400
    act(client, code, phone, action="timer", seconds=60)
    start = tv_state(client, code, tv)
    assert start["content"]["ends"] == start["now"] + 60_000
    clock.t += 20
    act(client, code, phone, action="timer_pause")
    assert tv_state(client, code, tv)["content"]["remaining"] == 40_000
    clock.t += 100  # paused: no time passes
    act(client, code, phone, action="timer_add", seconds=30)
    act(client, code, phone, action="timer_resume")
    state = tv_state(client, code, tv)
    assert state["content"]["remaining"] is None
    assert state["content"]["ends"] - state["now"] == 70_000
    assert state["content"]["total"] == 90


def test_several_phones_share_one_tv(client):
    code, tv = new_tv(client)
    first, second = join(client, code), join(client, code)
    act(client, code, first, action="clock")
    assert client.get(f"/api/screens/{code}/state", headers=second).get_json()["mode"] == "clock"
    assert tv_state(client, code, tv)["phones"] == 2
