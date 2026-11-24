"""Remote-control rooms for What The Spell.

A quizmaster starts a room on their phone (the host). The board on the TV (the display)
joins it by code and follows along. The host picks a word, sees it, and reveals it when
ready; the display is only ever told a word once it has been revealed, so nobody watching
the TV (or poking at its page) can see a word early.

Rooms live in memory: the app runs as a single process, and a room only needs to last a
quiz night. Idle rooms expire.

The grids themselves are public (the CSV is in a public repository), so a position such
as "row 2, column 3" must not give a word away. Each room therefore deals the grid's words
into its own random layout, which only the host sees; the TV's positions refer to that
layout. A new layout is dealt when the grid changes or the board is reset.
"""
import hmac
import secrets
import threading
import time

_random = secrets.SystemRandom()

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I or O, which look like 1 and 0
CODE_LENGTH = 4
ROOM_TTL_SECONDS = 12 * 60 * 60
MAX_ROOMS = 500
MODES = ("normal", "no-vowels", "backwards", "both")


class RoomError(Exception):
    """A request the room can't carry out; the message is safe to show."""


class RoomsFull(Exception):
    pass


class Room:
    def __init__(self, code, token):
        self.code = code
        self.token = token
        self.grid_idx = 0
        self.mode = "normal"
        self.chosen = None  # (row, col), 0-based
        self.revealed = set()  # {(row, col)}
        self.layout = []  # this room's shuffled copy of the current grid
        self.version = 0
        self.touched = time.time()

    def bump(self, now):
        self.version += 1
        self.touched = now


class RoomStore:
    def __init__(self, grids_provider, now=time.time):
        """grids_provider() returns the list of grids (each a list of rows of words)."""
        self._grids = grids_provider
        self._now = now
        self._rooms = {}
        self._lock = threading.Lock()

    # --- lifecycle -------------------------------------------------------------------

    def create(self):
        with self._lock:
            self._prune()
            if len(self._rooms) >= MAX_ROOMS:
                raise RoomsFull()
            code = self._new_code()
            room = Room(code, secrets.token_urlsafe(24))
            room.touched = self._now()
            room.layout = self._deal(room.grid_idx)
            self._rooms[code] = room
            return room

    def get(self, code):
        code = (code or "").strip().upper()
        with self._lock:
            room = self._rooms.get(code)
            if room is None or self._expired(room):
                self._rooms.pop(code, None)
                return None
            return room

    def is_host(self, room, token):
        return bool(token) and hmac.compare_digest(room.token, token)

    # --- what each side sees ----------------------------------------------------------

    def display_state(self, room):
        """What the TV may know: layout, mode, which cell is chosen, and revealed words only."""
        with self._lock:
            grid = room.layout
            revealed = {f"{r}-{c}": grid[r][c] for (r, c) in sorted(room.revealed)}
            return {
                "code": room.code,
                "version": room.version,
                "grid": room.grid_idx,
                "rows": len(grid),
                "cols": len(grid[0]) if grid else 0,
                "mode": room.mode,
                "chosen": list(room.chosen) if room.chosen else None,
                "chosen_revealed": bool(room.chosen and room.chosen in room.revealed),
                "revealed": revealed,
            }

    def host_state(self, room):
        """Everything, including every word, for the quizmaster's phone."""
        state = self.display_state(room)
        with self._lock:
            state["words"] = [list(row) for row in room.layout]
        state["num_grids"] = len(self._grids())
        return state

    # --- host actions -----------------------------------------------------------------

    def act(self, room, action, data):
        with self._lock:
            grid = room.layout
            if action == "grid":
                idx = data.get("grid")
                if not isinstance(idx, int) or not 0 <= idx < len(self._grids()):
                    raise RoomError("No grid with that number.")
                room.grid_idx = idx
                room.layout = self._deal(idx)
                room.chosen = None
                room.revealed = set()
            elif action == "choose":
                row, col = data.get("row"), data.get("col")
                if not (isinstance(row, int) and isinstance(col, int)
                        and 0 <= row < len(grid) and 0 <= col < len(grid[row])):
                    raise RoomError("No word at that spot.")
                room.chosen = (row, col)
            elif action == "reveal":
                if room.chosen is None:
                    raise RoomError("Choose a word first.")
                room.revealed.add(room.chosen)
            elif action == "clear":
                room.chosen = None
            elif action == "mode":
                mode = data.get("mode")
                if mode not in MODES:
                    raise RoomError("Unknown mode.")
                room.mode = mode
            elif action == "reset":
                room.layout = self._deal(room.grid_idx)
                room.chosen = None
                room.revealed = set()
            else:
                raise RoomError("Unknown action.")
            room.bump(self._now())

    # --- helpers ----------------------------------------------------------------------

    def _grid(self, idx):
        grids = self._grids()
        return grids[idx] if 0 <= idx < len(grids) else []

    def _deal(self, idx):
        """The grid's words in a fresh random order, in the same rows-by-columns shape."""
        grid = self._grid(idx)
        words = [w for row in grid for w in row]
        _random.shuffle(words)
        out, i = [], 0
        for row in grid:
            out.append(words[i:i + len(row)])
            i += len(row)
        return out

    def _expired(self, room):
        return self._now() - room.touched > ROOM_TTL_SECONDS

    def _prune(self):
        for code in [c for c, r in self._rooms.items() if self._expired(r)]:
            del self._rooms[code]

    def _new_code(self):
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self._rooms:
                return code
