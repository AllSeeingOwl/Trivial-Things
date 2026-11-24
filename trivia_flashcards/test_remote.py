"""Phone remote for Trivia Flashcards: the TV never gets an answer before it's shown."""
import pytest

import trivia_flashcards.trivia_flashcards_app as trivia
from trivia_flashcards.remote import RoomStore


@pytest.fixture
def qs(monkeypatch):
    questions = {
        f'{i}_A': {'id': f'{i}_A', 'question': f'Question {i}?', 'answer': f'Answer {i}', 'used': False}
        for i in range(1, 4)
    }

    def mark(q_id, used):
        questions[q_id]['used'] = used

    def reset():
        for q in questions.values():
            q['used'] = False

    monkeypatch.setattr(trivia, 'load_questions', lambda: questions)
    monkeypatch.setattr(trivia, 'update_used_status', mark)
    monkeypatch.setattr(trivia, 'reset_all_questions', reset)
    # Fresh rooms for each test, using the patched questions.
    trivia.ROOMS.__init__(trivia.TriviaGame())
    return questions


@pytest.fixture
def client(qs):
    return trivia.app.test_client()


def start(client):
    body = client.post('/api/rooms').get_json()
    return body['code'], {'X-Host-Token': body['token']}, body['state']


def act(client, code, host, **data):
    return client.post(f'/api/rooms/{code}/actions', json=data, headers=host)


def tv(client, code):
    return client.get(f'/api/rooms/{code}')


def test_tv_gets_the_question_but_not_the_answer(client, qs):
    code, host, state = start(client)
    assert state['question'] and state['answer']  # the phone sees both
    res = tv(client, code)
    body = res.get_json()
    assert body['question'] == state['question']
    assert body['answer'] is None and body['revealed'] is False
    for q in qs.values():
        assert q['answer'] not in res.get_data(as_text=True)


def test_reveal_and_hide(client):
    code, host, state = start(client)
    act(client, code, host, action='reveal')
    assert tv(client, code).get_json()['answer'] == state['answer']
    act(client, code, host, action='hide')
    assert tv(client, code).get_json()['answer'] is None


def test_skip_keeps_the_question_and_moves_on(client, qs):
    code, host, state = start(client)
    act(client, code, host, action='reveal')
    new = act(client, code, host, action='skip').get_json()
    assert new['question'] != state['question']
    assert new['revealed'] is False
    assert not any(q['used'] for q in qs.values())


def test_eliminate_marks_used_until_reset(client, qs):
    code, host, _ = start(client)
    for _ in range(3):
        assert act(client, code, host, action='eliminate').status_code == 200
    state = tv(client, code).get_json()
    assert state['empty'] is True and state['question'] is None
    assert state['stats'] == {'total': 3, 'used': 3, 'remaining': 0}
    assert act(client, code, host, action='eliminate').status_code == 400
    act(client, code, host, action='reset')
    state = tv(client, code).get_json()
    assert state['empty'] is False and state['stats']['used'] == 0


def test_only_the_host_can_act(client):
    code, _, _ = start(client)
    assert client.post(f'/api/rooms/{code}/actions', json={'action': 'reveal'}).status_code == 403


def test_board_page_has_the_remote_and_host_page_loads(client):
    page = client.get('/').get_data(as_text=True)
    assert 'id="remote-open-btn"' in page and 'id="remote-view"' in page
    assert page.index('js/remote-follow.js') < page.index('js/remote-tv.js') < page.index('js/script.js')
    host = client.get('/host')
    assert host.status_code == 200 and host.headers['Cache-Control'] == 'no-store'
