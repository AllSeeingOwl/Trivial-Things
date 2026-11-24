"""Phone remote for MCQ Flashcards: the TV gets the choices, but not the right one until it's shown."""
import pytest

import mcq_flashcards.mcq_flashcards_app as mcq


@pytest.fixture
def qs(monkeypatch):
    questions = {
        str(i): {'id': str(i), 'question': f'Question {i}?', 'answer': f'Right {i}',
                 'choices': [f'Right {i}', f'Wrong {i}a', f'Wrong {i}b', f'Wrong {i}c'], 'used': False}
        for i in range(1, 4)
    }
    monkeypatch.setattr(mcq, 'load_questions', lambda: questions)
    monkeypatch.setattr(mcq, 'update_used_status', lambda q_id, used: questions[q_id].update(used=used))
    monkeypatch.setattr(mcq, 'reset_all_questions', lambda: [q.update(used=False) for q in questions.values()])
    mcq.ROOMS.__init__(mcq.McqGame())
    return questions


@pytest.fixture
def client(qs):
    return mcq.app.test_client()


def start(client):
    body = client.post('/api/rooms').get_json()
    return body['code'], {'X-Host-Token': body['token']}, body['state']


def act(client, code, host, **data):
    return client.post(f'/api/rooms/{code}/actions', json=data, headers=host)


def tv(client, code):
    return client.get(f'/api/rooms/{code}').get_json()


def test_tv_gets_choices_but_not_which_is_right(client):
    code, host, state = start(client)
    assert state['choices'][state['correct']].startswith('Right')  # the phone knows
    shown = tv(client, code)
    assert shown['choices'] == state['choices'] and len(shown['choices']) == 4
    assert shown['correct'] is None and shown['revealed'] is False


def test_pick_then_reveal(client):
    code, host, state = start(client)
    wrong = (state['correct'] + 1) % 4
    assert act(client, code, host, action='pick', choice=wrong).status_code == 200
    shown = tv(client, code)
    assert shown['picked'] == wrong and shown['correct'] is None
    act(client, code, host, action='reveal')
    shown = tv(client, code)
    assert shown['revealed'] is True and shown['correct'] == state['correct'] and shown['picked'] == wrong
    assert act(client, code, host, action='pick', choice=state['correct']).status_code == 400


def test_pick_can_change_or_clear_before_reveal(client):
    code, host, _ = start(client)
    act(client, code, host, action='pick', choice=1)
    act(client, code, host, action='pick', choice=2)
    assert tv(client, code)['picked'] == 2
    act(client, code, host, action='pick', choice=None)
    assert tv(client, code)['picked'] is None


@pytest.mark.parametrize('choice', [4, -1, '1', 1.5])
def test_bad_picks_are_refused(client, choice):
    code, host, _ = start(client)
    assert act(client, code, host, action='pick', choice=choice).status_code == 400


def test_skip_eliminate_reset(client, qs):
    code, host, state = start(client)
    act(client, code, host, action='reveal')
    new = act(client, code, host, action='skip').get_json()
    assert new['question'] != state['question'] and new['revealed'] is False and new['picked'] is None
    for _ in range(3):
        act(client, code, host, action='eliminate')
    assert tv(client, code)['empty'] is True
    act(client, code, host, action='reset')
    assert tv(client, code)['stats']['used'] == 0


def test_board_page_has_the_remote(client):
    page = client.get('/').get_data(as_text=True)
    assert 'id="remote-open-btn"' in page and 'id="remote-view"' in page
    assert page.index('js/remote-follow.js') < page.index('js/remote-tv.js') < page.index('js/script.js')
    assert client.get('/host').status_code == 200
