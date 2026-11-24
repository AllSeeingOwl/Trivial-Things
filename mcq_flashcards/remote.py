"""Phone remote for the quiz apps: the quizmaster's phone runs the board on the TV.

Canonical copy: shared/remote/remote.py. Each app gets its own copy (as remote.py) from
`python3 tools/sync_shared.py`; edit this one.

A quizmaster starts a room on their phone (the host) and gets a four-letter code. The board
on the TV (the display) joins it by code and follows along. Each app supplies a *game* that
decides what the room holds and, above all, what the TV may see: answers stay on the phone
until the quizmaster reveals them, so nobody watching the TV, or reading its page, sees one
early.

A game is any object with:
    new_state()                -> dict, the room's starting state
    display_view(state)        -> dict sent to the TV; must not contain anything secret
    host_view(state)           -> dict sent to the host phone (may include answers)
    act(state, action, data)   -> changes state; raise RoomError(message) to refuse

Rooms live in memory: each app runs as a single process, and a room only needs to last a
quiz night. Idle rooms expire.
"""
import hmac
import secrets
import threading
import time

from flask import jsonify, render_template, request

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I or O, which look like 1 and 0
CODE_LENGTH = 4
ROOM_TTL_SECONDS = 12 * 60 * 60
MAX_ROOMS = 500


class RoomError(Exception):
    """A request the room can't carry out; the message is safe to show."""


class RoomsFull(Exception):
    pass


class Room:
    def __init__(self, code, token, state, now):
        self.code = code
        self.token = token
        self.state = state
        self.version = 0
        self.touched = now


class RoomStore:
    def __init__(self, game, now=time.time):
        self.game = game
        self._now = now
        self._rooms = {}
        self._lock = threading.Lock()

    def create(self):
        with self._lock:
            self._prune()
            if len(self._rooms) >= MAX_ROOMS:
                raise RoomsFull()
            code = self._new_code()
            room = Room(code, secrets.token_urlsafe(24), self.game.new_state(), self._now())
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

    def display_state(self, room):
        with self._lock:
            view = dict(self.game.display_view(room.state))
            view.update(code=room.code, version=room.version)
            return view

    def host_state(self, room):
        with self._lock:
            view = dict(self.game.host_view(room.state))
            view.update(code=room.code, version=room.version)
            return view

    def act(self, room, action, data):
        with self._lock:
            self.game.act(room.state, action, data)
            room.version += 1
            room.touched = self._now()

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


def _no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    return response


def add_remote_routes(app, store, host_template='host.html'):
    """Adds /host (the phone page) and the /api/rooms endpoints to a Flask app."""

    @app.route('/host')
    def remote_host_page():
        return _no_store(app.make_response(render_template(host_template)))

    @app.route('/api/rooms', methods=['POST'])
    def remote_create_room():
        try:
            room = store.create()
        except RoomsFull:
            return jsonify({'error': 'Too many remotes are running. Try again later.'}), 503
        return _no_store(jsonify({'code': room.code, 'token': room.token,
                                  'state': store.host_state(room)})), 201

    @app.route('/api/rooms/<code>')
    def remote_display_state(code):
        room = store.get(code)
        if room is None:
            return jsonify({'error': 'No remote with that code.'}), 404
        return _no_store(jsonify(store.display_state(room)))

    def host_room(code):
        room = store.get(code)
        if room is None:
            return None, (jsonify({'error': 'No remote with that code.'}), 404)
        if not store.is_host(room, request.headers.get('X-Host-Token', '')):
            return None, (jsonify({'error': 'This phone is not the remote for that code.'}), 403)
        return room, None

    @app.route('/api/rooms/<code>/host')
    def remote_host_state(code):
        room, err = host_room(code)
        if err:
            return err
        return _no_store(jsonify(store.host_state(room)))

    @app.route('/api/rooms/<code>/actions', methods=['POST'])
    def remote_action(code):
        room, err = host_room(code)
        if err:
            return err
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({'error': 'Send a JSON object.'}), 400
        try:
            store.act(room, data.get('action'), data)
        except RoomError as e:
            return jsonify({'error': str(e)}), 400
        return _no_store(jsonify(store.host_state(room)))

    return store
