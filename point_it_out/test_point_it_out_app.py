import os

import pytest

import point_it_out_app as app_module
from point_it_out_app import app as flask_app, parse_area, parse_row, pick_questions, score_answer, distance_to_area


@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        yield client


def make_row(**overrides):
    row = {
        'Category': 'Space',
        'Question': 'Point to Jupiter.',
        'Pictures': 'solar_system.svg',
        'Correct Picture': '1',
        'Answer Area': '40, 30, 10, 20',
        'Explanation': 'Biggest planet.',
    }
    row.update(overrides)
    return row


# --- CSV parsing ---------------------------------------------------------

def test_bundled_csv_loads_every_row():
    import csv
    with open(os.path.join(app_module.BASE_DIR, 'Point It Out.csv'), encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    assert len(app_module.QUESTIONS) == len(rows) > 0


def test_parse_area_converts_percent_to_fractions():
    assert parse_area('40, 30, 10, 20') == pytest.approx((0.4, 0.3, 0.1, 0.2))
    assert parse_area('') is None
    assert parse_area(None) is None


@pytest.mark.parametrize('text', ['1, 2, 3', 'a, b, c, d', '90, 0, 20, 10', '-1, 0, 5, 5', '0, 0, 0, 5', 'nan, 0, 5, 5'])
def test_parse_area_rejects_bad_values(text):
    with pytest.raises(ValueError):
        parse_area(text)


def test_parse_row_multi_picture_question():
    q = parse_row(make_row(Pictures='flag_ireland.svg | flag_italy.svg', **{'Correct Picture': '2', 'Answer Area': ''}), 7)
    assert q['id'] == '7'
    assert q['pictures'] == ['flag_ireland.svg', 'flag_italy.svg']
    assert q['correct'] == 1
    assert q['area'] is None
    assert q['public']['mode'] == 'picture'


def test_parse_row_defaults_correct_picture_to_first():
    assert parse_row(make_row(**{'Correct Picture': ''}), 0)['correct'] == 0


@pytest.mark.parametrize('overrides', [
    {'Question': ''},
    {'Pictures': ''},
    {'Pictures': 'missing.svg'},
    {'Pictures': '../point_it_out_app.py'},
    {'Pictures': 'solar_system.svg', 'Correct Picture': '2'},
    {'Correct Picture': 'one'},
])
def test_parse_row_rejects_bad_rows(overrides):
    with pytest.raises(ValueError):
        parse_row(make_row(**overrides), 0)


def test_load_data_skips_bad_rows(tmp_path):
    csv_file = tmp_path / 'q.csv'
    csv_file.write_text(
        'Category,Question,Pictures,Correct Picture,Answer Area,Explanation\n'
        'A,Good,piano.svg,1,,\n'
        'A,Bad,nope.svg,1,,\n',
        encoding='utf-8')
    data = app_module.load_data(str(csv_file))
    assert [q['question'] for q in data] == ['Good']


# --- Sets ----------------------------------------------------------------

def test_set_rows_can_reuse_pictures(tmp_path):
    csv_file = tmp_path / 'q.csv'
    csv_file.write_text(
        'Category,Question,Pictures,Correct Picture,Answer Area,Explanation,Set\n'
        'Music,Point to E,piano.svg,1,"28.75, 0, 8.75, 100",,Piano\n'
        'Music,Point to B,,1,"78.75, 0, 8.75, 100",,Piano\n'
        'Music,Odd one,clock.svg,1,,,Piano\n'
        'Music,No set and no pictures,,1,,,\n',
        encoding='utf-8')
    data = app_module.load_data(str(csv_file))
    assert [q['question'] for q in data] == ['Point to E', 'Point to B']
    assert data[1]['pictures'] == ['piano.svg'] and data[1]['set'] == 'Piano'


def test_csv_without_set_column_still_loads(tmp_path):
    csv_file = tmp_path / 'q.csv'
    csv_file.write_text('Category,Question,Pictures,Correct Picture,Answer Area,Explanation\nA,Q,piano.svg,1,,\n', encoding='utf-8')
    assert app_module.load_data(str(csv_file))[0]['set'] == ''


def fake(qid, set_name=''):
    return {'id': qid, 'set': set_name}


def test_pick_questions_keeps_each_set_together():
    questions = [fake('a1', 'A'), fake('s1'), fake('a2', 'A'), fake('b1', 'B'), fake('s2'), fake('a3', 'A'), fake('b2', 'B')]
    for _ in range(50):
        picked = pick_questions(questions, 100)
        assert sorted(q['id'] for q in picked) == sorted(q['id'] for q in questions)
        sets = [q['set'] for q in picked if q['set']]
        # Each set appears as one unbroken run.
        runs = [s for i, s in enumerate(sets) if i == 0 or sets[i - 1] != s]
        assert sorted(runs) == ['A', 'B']
        positions = [i for i, q in enumerate(picked) if q['set'] == 'A']
        assert positions == list(range(positions[0], positions[0] + 3))


def test_pick_questions_respects_count():
    questions = [fake('a1', 'A'), fake('a2', 'A'), fake('a3', 'A'), fake('s1')]
    for _ in range(20):
        assert len(pick_questions(questions, 2)) == 2


def test_bundled_sets_share_pictures():
    by_set = {}
    for q in app_module.QUESTIONS:
        if q['set']:
            by_set.setdefault(q['set'], set()).add(tuple(q['pictures']))
    assert len(by_set) >= 3
    assert all(len(p) == 1 for p in by_set.values())


# --- Scoring -------------------------------------------------------------

def test_distance_to_area():
    area = (0.4, 0.3, 0.1, 0.2)
    assert distance_to_area(0.45, 0.4, area) == 0
    assert distance_to_area(0.3, 0.4, area) == pytest.approx(0.1)
    assert distance_to_area(0.53, 0.54, area) == pytest.approx(0.05)


def test_score_area_question():
    q = parse_row(make_row(), 0)
    assert score_answer(q, 0, 0.45, 0.4) == (10, 'correct')
    assert score_answer(q, 0, 0.52, 0.4) == (5, 'close')
    assert score_answer(q, 0, 0.9, 0.9) == (0, 'wrong')


def test_score_picture_question():
    q = parse_row(make_row(Pictures='flag_ireland.svg | flag_italy.svg', **{'Answer Area': ''}), 0)
    assert score_answer(q, 0, 0.99, 0.01) == (10, 'correct')
    assert score_answer(q, 1, 0.5, 0.5) == (0, 'wrong')


# --- API -----------------------------------------------------------------

def test_questions_hide_answers(client):
    data = client.get('/api/questions?count=100').get_json()
    assert len(data) == len(app_module.QUESTIONS)
    for q in data:
        assert set(q) == {'id', 'set', 'category', 'question', 'pictures', 'mode'}


@pytest.mark.parametrize('count', ['abc', '-3', '0', '9' * 20])
def test_questions_bad_count_falls_back(client, count):
    data = client.get('/api/questions?count=' + count).get_json()
    assert len(data) == min(5, len(app_module.QUESTIONS))


def test_answer_correct_and_reveals_area(client):
    q = next(q for q in app_module.QUESTIONS if q['area'])
    left, top, width, height = q['area']
    res = client.post('/api/answer', json={
        'id': q['id'], 'picture': q['correct'], 'x': left + width / 2, 'y': top + height / 2})
    body = res.get_json()
    assert res.status_code == 200
    assert body['points'] == 10 and body['verdict'] == 'correct'
    assert body['area']['left'] == pytest.approx(left)
    assert body['correct_picture'] == q['correct']


def test_answer_wrong_picture(client):
    q = next(q for q in app_module.QUESTIONS if len(q['pictures']) > 1)
    wrong = (q['correct'] + 1) % len(q['pictures'])
    body = client.post('/api/answer', json={'id': q['id'], 'picture': wrong, 'x': 0.5, 'y': 0.5}).get_json()
    assert body['points'] == 0 and body['verdict'] == 'wrong'
    assert body['area'] is None


@pytest.mark.parametrize('payload,status', [
    (None, 400),
    ({'id': 5, 'picture': 0, 'x': 0.5, 'y': 0.5}, 400),
    ({'id': '0', 'picture': True, 'x': 0.5, 'y': 0.5}, 400),
    ({'id': '0', 'picture': 0.5, 'x': 0.5, 'y': 0.5}, 400),
    ({'id': '0', 'picture': 0, 'x': 1.5, 'y': 0.5}, 400),
    ({'id': '0', 'picture': 0, 'x': '0.5', 'y': 0.5}, 400),
    ({'id': '0', 'picture': 99, 'x': 0.5, 'y': 0.5}, 400),
    ({'id': 'nope', 'picture': 0, 'x': 0.5, 'y': 0.5}, 404),
])
def test_answer_validation(client, payload, status):
    if payload is None:
        res = client.post('/api/answer', data='not json', content_type='application/json')
    else:
        res = client.post('/api/answer', json=payload)
    assert res.status_code == status


def test_images_listing(client):
    names = client.get('/api/images').get_json()
    assert 'solar_system.svg' in names
    assert all(n.endswith(app_module.IMAGE_EXTENSIONS) for n in names)


def test_every_question_picture_is_served(client):
    for q in app_module.QUESTIONS:
        for name in q['pictures']:
            assert client.get('/pictures/' + name).status_code == 200


@pytest.mark.parametrize('name', ['..%2Fpoint_it_out_app.py', 'point_it_out_app.py', '.hidden.png', 'nope.png'])
def test_pictures_route_refuses_anything_else(client, name):
    assert client.get('/pictures/' + name).status_code == 404


def test_pictures_dir_setting_uses_a_private_folder(tmp_path, monkeypatch):
    import importlib
    (tmp_path / 'chaplin.png').write_bytes(b'\x89PNG fake')
    (tmp_path / 'questions.csv').write_text(
        'Category,Question,Pictures,Correct Picture,Answer Area,Explanation\n'
        'Film,Which one is Charlie Chaplin?,chaplin.png,1,,\n', encoding='utf-8')
    monkeypatch.setenv('PICTURES_DIR', str(tmp_path))
    monkeypatch.setenv('CSV_FILE', str(tmp_path / 'questions.csv'))
    try:
        mod = importlib.reload(app_module)
        assert [q['question'] for q in mod.QUESTIONS] == ['Which one is Charlie Chaplin?']
        c = mod.app.test_client()
        assert c.get('/api/images').get_json() == ['chaplin.png']
        assert c.get('/pictures/chaplin.png').status_code == 200
        assert c.get('/pictures/piano.svg').status_code == 404
    finally:
        monkeypatch.delenv('PICTURES_DIR')
        monkeypatch.delenv('CSV_FILE')
        importlib.reload(app_module)


# --- Pages and headers ---------------------------------------------------

@pytest.mark.parametrize('path', ['/', '/editor'])
def test_pages_have_back_link_and_security_headers(client, path):
    res = client.get(path)
    assert res.status_code == 200
    html = res.get_data(as_text=True)
    assert 'aria-label="Back to Central Portal"' in html
    assert '<span aria-hidden="true">← </span>' in html
    assert res.headers['X-Content-Type-Options'] == 'nosniff'
    assert res.headers['X-Frame-Options'] == 'SAMEORIGIN'
    csp = res.headers['Content-Security-Policy']
    assert "default-src 'self'" in csp and 'unsafe-inline' not in csp
