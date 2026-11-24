"""Phone remote: the quizmaster's phone controls the board; the TV never sees a word early."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

import what_the_spell_app as spell  # noqa: E402
from rooms import RoomStore, ROOM_TTL_SECONDS  # noqa: E402


@pytest.fixture
def client():
    spell.ROOMS = RoomStore(lambda: spell.load_data()[0])
    return spell.app.test_client()


def start(client):
    res = client.post('/api/rooms')
    assert res.status_code == 201
    body = res.get_json()
    assert len(body['code']) == 4 and body['token']
    return body['code'], {'X-Host-Token': body['token']}


def act(client, code, headers, **data):
    return client.post(f'/api/rooms/{code}/actions', json=data, headers=headers)


def all_words(client):
    return [w for row in spell.load_data()[0][0] for w in row]


def layout(client, code, host):
    return client.get(f'/api/rooms/{code}/host', headers=host).get_json()['words']


def test_display_never_sees_an_unrevealed_word(client):
    code, host = start(client)
    grid = layout(client, code, host)
    assert act(client, code, host, action='choose', row=1, col=2).status_code == 200

    text = client.get(f'/api/rooms/{code}').get_data(as_text=True)
    assert grid[1][2] not in text
    for word in all_words(client):
        assert f'"{word}"' not in text
    state = client.get(f'/api/rooms/{code}').get_json()
    assert state['chosen'] == [1, 2]
    assert state['chosen_revealed'] is False
    assert state['revealed'] == {}


def test_reveal_shows_only_that_word(client):
    code, host = start(client)
    grid = layout(client, code, host)
    act(client, code, host, action='choose', row=1, col=2)
    assert act(client, code, host, action='reveal').status_code == 200

    state = client.get(f'/api/rooms/{code}').get_json()
    assert state['revealed'] == {'1-2': grid[1][2]}
    assert state['chosen_revealed'] is True

    # Choosing the next word hides nothing already revealed, and shows nothing new.
    act(client, code, host, action='choose', row=0, col=0)
    state = client.get(f'/api/rooms/{code}').get_json()
    assert state['revealed'] == {'1-2': grid[1][2]}
    assert state['chosen_revealed'] is False


def test_host_sees_every_word(client):
    code, host = start(client)
    state = client.get(f'/api/rooms/{code}/host', headers=host).get_json()
    flat = sorted(w for row in state['words'] for w in row)
    assert flat == sorted(w for row in spell.load_data()[0][0] for w in row)
    assert state['num_grids'] == len(spell.load_data()[0])


def test_only_the_host_can_act_or_see_words(client):
    code, _ = start(client)
    for headers in ({}, {'X-Host-Token': 'not-the-token'}):
        assert act(client, code, headers, action='choose', row=0, col=0).status_code == 403
        assert client.get(f'/api/rooms/{code}/host', headers=headers).status_code == 403


def test_codes_are_case_insensitive_and_unknown_codes_404(client):
    code, _ = start(client)
    assert client.get(f'/api/rooms/{code.lower()}').status_code == 200
    unused = 'ZZZZ' if code != 'ZZZZ' else 'YYYY'
    assert client.get(f'/api/rooms/{unused}').status_code == 404
    assert client.get('/api/rooms/NOPE1').status_code == 404


def test_grid_mode_and_reset(client):
    code, host = start(client)
    act(client, code, host, action='choose', row=0, col=0)
    act(client, code, host, action='reveal')
    assert act(client, code, host, action='mode', mode='backwards').status_code == 200
    assert client.get(f'/api/rooms/{code}').get_json()['mode'] == 'backwards'

    assert act(client, code, host, action='reset').status_code == 200
    state = client.get(f'/api/rooms/{code}').get_json()
    assert state['revealed'] == {} and state['chosen'] is None

    if len(spell.load_data()[0]) > 1:
        act(client, code, host, action='choose', row=0, col=0)
        assert act(client, code, host, action='grid', grid=1).status_code == 200
        state = client.get(f'/api/rooms/{code}').get_json()
        assert state['grid'] == 1 and state['chosen'] is None


@pytest.mark.parametrize('data', [
    {'action': 'choose', 'row': 99, 'col': 0},
    {'action': 'choose', 'row': '1', 'col': 0},
    {'action': 'grid', 'grid': 999},
    {'action': 'mode', 'mode': 'sideways'},
    {'action': 'reveal'},  # nothing chosen yet
    {'action': 'explode'},
])
def test_bad_actions_are_refused(client, data):
    code, host = start(client)
    res = act(client, code, host, **data)
    assert res.status_code == 400
    assert res.get_json()['error']


def test_version_goes_up_with_each_change(client):
    code, host = start(client)
    v0 = client.get(f'/api/rooms/{code}').get_json()['version']
    act(client, code, host, action='choose', row=0, col=0)
    assert client.get(f'/api/rooms/{code}').get_json()['version'] == v0 + 1


def test_idle_rooms_expire():
    clock = [1000.0]
    store = RoomStore(lambda: [[['a']]], now=lambda: clock[0])
    room = store.create()
    assert store.get(room.code) is room
    clock[0] += ROOM_TTL_SECONDS + 1
    assert store.get(room.code) is None


def test_host_page_and_responses_are_not_cached(client):
    assert client.get('/host').status_code == 200
    code, _ = start(client)
    assert client.get(f'/api/rooms/{code}').headers['Cache-Control'] == 'no-store'


def test_each_remote_shuffles_where_words_sit(client):
    """The grids are public (the CSV is in a public repo), so a position like "2-3"
    must not give the word away. Each remote deals the words into its own layout."""
    original = spell.load_data()[0][0]
    layouts = []
    for _ in range(4):
        code, host = start(client)
        words = client.get(f'/api/rooms/{code}/host', headers=host).get_json()['words']
        assert sorted(w for row in words for w in row) == sorted(w for row in original for w in row)
        assert [len(r) for r in words] == [len(r) for r in original]
        layouts.append(words)
    # Four remotes all landing on the CSV's own order (or on one shared order) would mean no shuffle.
    assert any(l != original for l in layouts)
    assert len({str(l) for l in layouts}) > 1


def test_revealed_word_matches_the_hosts_layout(client):
    code, host = start(client)
    words = client.get(f'/api/rooms/{code}/host', headers=host).get_json()['words']
    act(client, code, host, action='choose', row=4, col=5)
    act(client, code, host, action='reveal')
    assert client.get(f'/api/rooms/{code}').get_json()['revealed'] == {'4-5': words[4][5]}


def test_layout_holds_during_a_game_and_reshuffles_on_reset(client):
    code, host = start(client)
    first = client.get(f'/api/rooms/{code}/host', headers=host).get_json()['words']
    act(client, code, host, action='choose', row=0, col=0)
    act(client, code, host, action='mode', mode='both')
    assert client.get(f'/api/rooms/{code}/host', headers=host).get_json()['words'] == first
    seen = set()
    for _ in range(4):
        act(client, code, host, action='reset')
        seen.add(str(client.get(f'/api/rooms/{code}/host', headers=host).get_json()['words']))
    assert len(seen | {str(first)}) > 1
