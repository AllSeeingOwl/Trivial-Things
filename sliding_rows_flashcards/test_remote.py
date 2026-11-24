"""Phone remote for Sliding Rows: the TV only gets each question and answer once it's shown."""
import pytest

import sliding_rows_flashcards.sliding_rows_flashcards_app as sliding


@pytest.fixture
def chains(monkeypatch):
    data = {
        cid: {'chain_id': cid, 'used': False, 'questions': [
            {'order': n, 'question': f'{cid} Q{n}?', 'answer': f'{cid} A{n}', 'used': False} for n in range(1, 4)]}
        for cid in ('c1', 'c2')
    }
    marked = []

    def mark(cid, used):
        data[cid]['used'] = used
        marked.append(cid)

    def reset():
        for c in data.values():
            c['used'] = False

    monkeypatch.setattr(sliding, 'load_chains', lambda: data)
    monkeypatch.setattr(sliding, 'update_chain_used_status', mark)
    monkeypatch.setattr(sliding, 'reset_all_chains', reset)
    sliding.ROOMS.__init__(sliding.SlidingRowsGame())
    return data, marked


@pytest.fixture
def client(chains):
    return sliding.app.test_client()


def start(client):
    body = client.post('/api/rooms').get_json()
    return body['code'], {'X-Host-Token': body['token']}, body['state']


def act(client, code, host, **data):
    return client.post(f'/api/rooms/{code}/actions', json=data, headers=host)


def tv(client, code):
    return client.get(f'/api/rooms/{code}')


def test_tv_gets_nothing_until_shown(client):
    code, host, state = start(client)
    assert all(r['question'] and r['answer'] for r in state['rows'])  # the phone sees everything
    res = tv(client, code)
    assert [r['state'] for r in res.get_json()['rows']] == [0, 0, 0]
    for r in state['rows']:
        assert r['question'] not in res.get_data(as_text=True)
        assert r['answer'] not in res.get_data(as_text=True)


def test_question_then_answer_row_by_row(client):
    code, host, state = start(client)
    act(client, code, host, action='show', row=0, part='question')
    rows = tv(client, code).get_json()['rows']
    assert rows[0]['question'] == state['rows'][0]['question'] and rows[0]['answer'] is None
    assert rows[1]['question'] is None
    act(client, code, host, action='show', row=0, part='answer')
    assert tv(client, code).get_json()['rows'][0]['answer'] == state['rows'][0]['answer']
    # Showing the question again never hides the answer.
    act(client, code, host, action='show', row=0, part='question')
    assert tv(client, code).get_json()['rows'][0]['state'] == 2


def test_chain_is_marked_used_once_every_answer_is_shown(client, chains):
    data, marked = chains
    code, host, _ = start(client)
    for row in range(3):
        act(client, code, host, action='show', row=row, part='answer')
    state = tv(client, code).get_json()
    assert state['complete'] is True and len(marked) == 1
    act(client, code, host, action='show', row=0, part='answer')
    assert len(marked) == 1


def test_next_skips_an_unfinished_chain_without_marking_it(client, chains):
    data, marked = chains
    code, host, state = start(client)
    act(client, code, host, action='show', row=0, part='question')
    new = act(client, code, host, action='next').get_json()
    assert new['rows'][0]['question'] != state['rows'][0]['question']
    assert [r['state'] for r in new['rows']] == [0, 0, 0] and marked == []


def test_all_used_then_reset(client, chains):
    code, host, _ = start(client)
    for _ in range(2):
        for row in range(3):
            act(client, code, host, action='show', row=row, part='answer')
        act(client, code, host, action='next')
    assert tv(client, code).get_json()['empty'] is True
    act(client, code, host, action='reset')
    assert tv(client, code).get_json()['stats']['used'] == 0


@pytest.mark.parametrize('data', [
    {'action': 'show', 'row': 9, 'part': 'answer'},
    {'action': 'show', 'row': 0, 'part': 'both'},
    {'action': 'show', 'row': '0', 'part': 'answer'},
    {'action': 'fly'},
])
def test_bad_actions_are_refused(client, data):
    code, host, _ = start(client)
    assert act(client, code, host, **data).status_code == 400


def test_board_page_has_the_remote(client):
    page = client.get('/').get_data(as_text=True)
    assert 'id="remote-open-btn"' in page and 'id="remote-view"' in page
    assert page.index('js/remote-follow.js') < page.index('js/remote-tv.js') < page.index('js/script.js')
    assert client.get('/host').status_code == 200
