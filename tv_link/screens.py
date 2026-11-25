"""TV Link screens: a TV shows a code, phones join with it and decide what the TV shows.

The TV opens /tv and gets a screen with a five-letter code. Any phone that types the code (or
scans the TV's QR code) can control that screen: show photos, a slideshow, a message, a YouTube
video, a countdown timer, a clock or a blank screen. Starting a new code on the TV ends the old
screen, so every phone that had it is disconnected.

Screens live in memory, like the quiz apps' remotes: the app runs as a single process and a
screen only needs to last while the TV is on. A screen ends when nothing has polled it or
changed it for SCREEN_TTL_SECONDS. Photos are held in memory too, with limits per photo, per
screen and overall.
"""
import hmac
import re
import secrets
import threading
import time
from collections import deque
from urllib.parse import parse_qs, urlparse

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I or O, which look like 1 and 0
CODE_LENGTH = 5
SCREEN_TTL_SECONDS = 60 * 60
MAX_SCREENS = 300

MAX_PHOTO_BYTES = 6 * 1024 * 1024
MAX_PHOTOS_PER_SCREEN = 40
MAX_SCREEN_BYTES = 60 * 1024 * 1024
MAX_TOTAL_BYTES = 400 * 1024 * 1024

MAX_MESSAGE_CHARS = 280
MAX_TIMER_SECONDS = 24 * 60 * 60
SLIDESHOW_SECONDS = (3, 5, 10, 20, 30, 60)

# Wrong codes allowed per address before joining is refused for a while, so codes can't be
# guessed by trying them all.
JOIN_FAILURES_ALLOWED = 20
JOIN_FAILURE_WINDOW_SECONDS = 10 * 60

MODES = ("home", "photo", "message", "video", "timer", "clock", "blank")

YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
                 "youtube-nocookie.com", "www.youtube-nocookie.com"}


class ScreenError(Exception):
    """A request the screen can't carry out; the message is safe to show."""


class Full(Exception):
    """No room for another screen (or another photo); the message is safe to show."""


def normalise_code(code):
    return re.sub(r"\s+", "", str(code or "")).upper()


def image_type(data):
    """The MIME type of a JPEG, PNG or GIF, from its first bytes; None for anything else.
    WebP and HEIC are refused because older TV browsers can't show them (the phone page
    converts every photo to JPEG before sending it)."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return None


def _seconds(value):
    """'90', '1m30s', '1h2m3s' or '1:30' -> whole seconds, or 0 when it can't be read."""
    value = (value or "").strip().lower()
    if value.isdigit():
        return int(value)
    m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?", value)
    if m and value:
        h, mins, s = (int(g or 0) for g in m.groups())
        return h * 3600 + mins * 60 + s
    return 0


def parse_youtube(url):
    """(video id, start seconds) for a YouTube link, or None.

    Accepts watch, youtu.be, shorts, live and embed links, with or without https://, plus a
    bare 11-character video id."""
    url = (url or "").strip()
    if YOUTUBE_ID.match(url):
        return url, 0
    if "://" not in url:
        url = "https://" + url
    try:
        parts = urlparse(url)
    except ValueError:
        return None
    host = (parts.hostname or "").lower()
    query = parse_qs(parts.query)
    path = [p for p in parts.path.split("/") if p]
    video = None
    if host in ("youtu.be", "www.youtu.be") and path:
        video = path[0]
    elif host in YOUTUBE_HOSTS:
        if path[:1] == ["watch"]:
            video = (query.get("v") or [None])[0]
        elif len(path) >= 2 and path[0] in ("shorts", "live", "embed", "v"):
            video = path[1]
    if not video or not YOUTUBE_ID.match(video):
        return None
    start = _seconds((query.get("t") or query.get("start") or [""])[0])
    return video, min(start, MAX_TIMER_SECONDS)


class Photo:
    def __init__(self, photo_id, data, mime):
        self.id = photo_id
        self.data = data
        self.mime = mime


class Screen:
    def __init__(self, code, tv_token, now):
        self.code = code
        self.tv_token = tv_token
        self.phone_tokens = set()
        self.photos = []  # in the order they were added
        self.mode = "home"
        self.content = {}
        self.version = 0
        self.touched = now
        self.tv_seen = now

    @property
    def photo_bytes(self):
        return sum(len(p.data) for p in self.photos)

    def photo(self, photo_id):
        for p in self.photos:
            if p.id == photo_id:
                return p
        return None


class ScreenStore:
    def __init__(self, now=time.time):
        self._now = now
        self._screens = {}
        self._failures = {}  # address -> deque of failure times
        self._lock = threading.Lock()

    # --- screens -------------------------------------------------------------------------

    def create(self):
        with self._lock:
            self._prune()
            if len(self._screens) >= MAX_SCREENS:
                raise Full("Too many TVs are connected right now. Try again later.")
            code = self._new_code()
            screen = Screen(code, secrets.token_urlsafe(24), self._now())
            self._screens[code] = screen
            return screen

    def get(self, code):
        code = normalise_code(code)
        with self._lock:
            screen = self._screens.get(code)
            if screen is None or self._expired(screen):
                self._screens.pop(code, None)
                return None
            return screen

    def end(self, screen):
        with self._lock:
            self._screens.pop(screen.code, None)

    def is_tv(self, screen, token):
        return bool(token) and hmac.compare_digest(screen.tv_token, token)

    def is_phone(self, screen, token):
        return bool(token) and any(hmac.compare_digest(t, token) for t in screen.phone_tokens)

    def tv_poll(self, screen):
        """The TV checking in: keeps the screen alive and returns what to show."""
        with self._lock:
            screen.touched = screen.tv_seen = self._now()
            return self._view(screen)

    def view(self, screen):
        with self._lock:
            return self._view(screen)

    # --- joining -------------------------------------------------------------------------

    def join_blocked(self, address):
        with self._lock:
            return len(self._recent_failures(address)) >= JOIN_FAILURES_ALLOWED

    def join_failed(self, address):
        with self._lock:
            self._recent_failures(address).append(self._now())

    def join(self, screen):
        with self._lock:
            token = secrets.token_urlsafe(24)
            screen.phone_tokens.add(token)
            screen.touched = self._now()
            screen.version += 1
            return token

    def _recent_failures(self, address):
        times = self._failures.setdefault(address, deque())
        cutoff = self._now() - JOIN_FAILURE_WINDOW_SECONDS
        while times and times[0] < cutoff:
            times.popleft()
        if len(self._failures) > 10000:  # forget quiet addresses
            for key in [k for k, v in self._failures.items() if not v and k != address]:
                del self._failures[key]
        return times

    # --- photos --------------------------------------------------------------------------

    def add_photo(self, screen, data):
        mime = image_type(data)
        if mime is None:
            raise ScreenError("That isn't a photo the TV can show. Send a JPEG, PNG or GIF.")
        if len(data) > MAX_PHOTO_BYTES:
            raise ScreenError("That photo is too large.")
        with self._lock:
            if len(screen.photos) >= MAX_PHOTOS_PER_SCREEN:
                raise ScreenError(f"This TV already has {MAX_PHOTOS_PER_SCREEN} photos. "
                                  "Remove some to add more.")
            if screen.photo_bytes + len(data) > MAX_SCREEN_BYTES:
                raise ScreenError("This TV's photos are full. Remove some to add more.")
            total = sum(s.photo_bytes for s in self._screens.values())
            if total + len(data) > MAX_TOTAL_BYTES:
                raise Full("The server is holding too many photos right now. Try again later.")
            photo = Photo(secrets.token_urlsafe(16), bytes(data), mime)
            screen.photos.append(photo)
            self._changed(screen)
            return photo

    def photo(self, screen, photo_id):
        with self._lock:
            return screen.photo(photo_id)

    # --- actions -------------------------------------------------------------------------

    def act(self, screen, action, data):
        with self._lock:
            handler = getattr(self, "_do_" + str(action), None) if action else None
            if handler is None:
                raise ScreenError("Unknown action.")
            handler(screen, data)
            self._changed(screen)

    def _do_home(self, screen, data):
        self._show(screen, "home", {})

    def _do_clock(self, screen, data):
        self._show(screen, "clock", {})

    def _do_blank(self, screen, data):
        self._show(screen, "blank", {})

    def _do_show_photo(self, screen, data):
        index = self._photo_index(screen, data.get("photo"))
        self._show(screen, "photo", {"index": index, "slideshow": 0, "started": self._ms()})

    def _do_step_photo(self, screen, data):
        if not screen.photos:
            raise ScreenError("Add a photo first.")
        delta = -1 if data.get("delta") == -1 else 1
        current = self._current_index(screen) if screen.mode == "photo" else -delta
        index = (current + delta) % len(screen.photos)
        seconds = screen.content.get("slideshow", 0) if screen.mode == "photo" else 0
        self._show(screen, "photo", {"index": index, "slideshow": seconds, "started": self._ms()})

    def _do_slideshow(self, screen, data):
        if not screen.photos:
            raise ScreenError("Add a photo first.")
        seconds = data.get("seconds")
        if seconds not in SLIDESHOW_SECONDS and seconds != 0:
            raise ScreenError("Pick how long each photo stays up.")
        index = self._current_index(screen) if screen.mode == "photo" else 0
        self._show(screen, "photo", {"index": index, "slideshow": seconds, "started": self._ms()})

    def _do_remove_photo(self, screen, data):
        photo = screen.photo(str(data.get("photo") or ""))
        if photo is None:
            raise ScreenError("That photo has already gone.")
        showing = self._current_index(screen) if screen.mode == "photo" else None
        removed_at = screen.photos.index(photo)
        screen.photos.remove(photo)
        if showing is None:
            return
        if not screen.photos:
            self._show(screen, "home", {})
            return
        if removed_at < showing:
            showing -= 1
        content = dict(screen.content, index=showing % len(screen.photos), started=self._ms())
        self._show(screen, "photo", content)

    def _do_message(self, screen, data):
        text = str(data.get("text") or "").strip()
        if not text:
            raise ScreenError("Type a message first.")
        if len(text) > MAX_MESSAGE_CHARS:
            raise ScreenError(f"Messages can be up to {MAX_MESSAGE_CHARS} characters.")
        self._show(screen, "message", {"text": text})

    def _do_video(self, screen, data):
        found = parse_youtube(str(data.get("url") or ""))
        if not found:
            raise ScreenError("That doesn't look like a YouTube link.")
        video, start = found
        self._show(screen, "video", {"youtube": video, "start": start, "playing": True,
                                     "muted": False, "command": 0})

    def _video_command(self, screen, **changes):
        if screen.mode != "video":
            raise ScreenError("No video is showing.")
        screen.content.update(changes)
        screen.content["command"] = screen.content.get("command", 0) + 1

    def _do_video_play(self, screen, data):
        self._video_command(screen, playing=True)

    def _do_video_pause(self, screen, data):
        self._video_command(screen, playing=False)

    def _do_video_mute(self, screen, data):
        self._video_command(screen, muted=bool(data.get("muted")))

    def _do_video_restart(self, screen, data):
        self._video_command(screen, playing=True, restart=screen.content.get("restart", 0) + 1)

    def _do_timer(self, screen, data):
        seconds = data.get("seconds")
        if not isinstance(seconds, int) or isinstance(seconds, bool) or not 1 <= seconds <= MAX_TIMER_SECONDS:
            raise ScreenError("Timers can run from 1 second to 24 hours.")
        self._show(screen, "timer", {"total": seconds, "ends": self._ms() + seconds * 1000,
                                     "remaining": None})

    def _timer(self, screen):
        if screen.mode != "timer":
            raise ScreenError("No timer is running.")
        return screen.content

    def _do_timer_pause(self, screen, data):
        timer = self._timer(screen)
        if timer["remaining"] is None:
            timer["remaining"] = max(0, timer["ends"] - self._ms())

    def _do_timer_resume(self, screen, data):
        timer = self._timer(screen)
        if timer["remaining"] is not None:
            timer["ends"] = self._ms() + timer["remaining"]
            timer["remaining"] = None

    def _do_timer_add(self, screen, data):
        timer = self._timer(screen)
        extra = data.get("seconds")
        if not isinstance(extra, int) or isinstance(extra, bool) or not 1 <= extra <= 3600:
            raise ScreenError("Add between 1 second and an hour.")
        if timer["remaining"] is not None:
            timer["remaining"] = min(timer["remaining"] + extra * 1000, MAX_TIMER_SECONDS * 1000)
        else:
            timer["ends"] = max(timer["ends"], self._ms()) + extra * 1000
        timer["total"] = min(timer["total"] + extra, MAX_TIMER_SECONDS)

    # --- helpers -------------------------------------------------------------------------

    def _ms(self):
        return int(self._now() * 1000)

    def _show(self, screen, mode, content):
        screen.mode = mode
        screen.content = content

    def _changed(self, screen):
        screen.version += 1
        screen.touched = self._now()

    def _photo_index(self, screen, photo_id):
        for i, p in enumerate(screen.photos):
            if p.id == photo_id:
                return i
        raise ScreenError("That photo has gone.")

    def _current_index(self, screen):
        """The photo on the TV now, counting slides the slideshow has moved on since it began."""
        content = screen.content
        index = content.get("index", 0)
        if content.get("slideshow"):
            index += int((self._ms() - content.get("started", 0)) // (content["slideshow"] * 1000))
        return index % len(screen.photos) if screen.photos else 0

    def _view(self, screen):
        """What the TV and phones are told. Nothing here is secret: anyone with the code sees the TV."""
        return {
            "code": screen.code,
            "version": screen.version,
            "now": self._ms(),
            "mode": screen.mode,
            "content": dict(screen.content),
            "photos": [p.id for p in screen.photos],
            "phones": len(screen.phone_tokens),
            "tv_online": self._now() - screen.tv_seen < 10,
        }

    def _expired(self, screen):
        return self._now() - screen.touched > SCREEN_TTL_SECONDS

    def _prune(self):
        for code in [c for c, s in self._screens.items() if self._expired(s)]:
            del self._screens[code]

    def _new_code(self):
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self._screens:
                return code
