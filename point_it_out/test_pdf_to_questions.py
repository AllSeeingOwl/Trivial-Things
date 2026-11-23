"""Tests for tools/pdf_to_questions.py, using small PDFs built on the fly."""
import csv
import os
import sys

import pytest

pymupdf = pytest.importorskip('pymupdf')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tools'))
import pdf_to_questions as tool  # noqa: E402

import point_it_out_app as app_module  # noqa: E402

PNG = None


def png_bytes():
    global PNG
    if PNG is None:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 8, 8), False)
        pix.clear_with(200)
        PNG = pix.tobytes('png')
    return PNG


# Picture n sits at these spots: two columns of two, numbered down each column,
# with the number printed to the left of each picture.
SPOTS = {1: (60, 60), 2: (60, 300), 3: (330, 60), 4: (330, 300)}
ANSWERS = {1: 'Four Of A Kind (Poker Hand)', 2: 'The Flag Of Libya', 3: 'Gin Fizz (Shake) Cocktail', 4: 'Bop It (Toy)'}


def make_pictures_pdf(path, print_numbers=True, shuffle_draw_order=True):
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=560)
    order = [4, 1, 3, 2] if shuffle_draw_order else [1, 2, 3, 4]
    for n in order:
        x, y = SPOTS[n]
        page.insert_image(pymupdf.Rect(x, y, x + 200, y + 200), stream=png_bytes())
        if print_numbers:
            page.insert_text((x - 30, y + 100), str(n), fontsize=14)
    doc.save(path)


def make_answers_pdf(path, same_line=False):
    doc = pymupdf.open()
    page = doc.new_page()
    y = 60
    page.insert_text((50, 40), 'Page A (Answers)')
    for n, label in ANSWERS.items():
        if same_line:
            page.insert_text((50, y), f'{n} {label}')
            y += 20
        else:
            page.insert_text((50, y), str(n))
            page.insert_text((50, y + 16), label)
            y += 40
    doc.save(path)


def read_rows(path):
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


@pytest.fixture
def pdfs(tmp_path):
    pictures = tmp_path / 'Page A (Alpha).pdf'
    answers = tmp_path / 'Page A (Answers-Alpha).pdf'
    make_pictures_pdf(str(pictures))
    make_answers_pdf(str(answers))
    return pictures, answers


# --- Reading answers -------------------------------------------------------

def test_answers_on_separate_lines_and_wrapped():
    text = 'Page A (Answers)\n1\nFour Of A Kind\n(Poker Hand)\n2\nThe Flag Of Libya\n'
    assert tool.parse_answer_text(text) == {1: 'Four Of A Kind (Poker Hand)', 2: 'The Flag Of Libya'}


def test_answers_on_the_same_line_and_ignores_years():
    text = '1. Zombies Ate My Neighbours\n(1993 Video Game)\n2) Mario\n1993 should not start an answer'
    assert tool.parse_answer_text(text) == {
        1: 'Zombies Ate My Neighbours (1993 Video Game)',
        2: 'Mario 1993 should not start an answer',
    }


def test_answers_from_pdf_and_csv(tmp_path):
    pdf = tmp_path / 'a.pdf'
    make_answers_pdf(str(pdf), same_line=True)
    assert tool.load_answers(str(pdf)) == ANSWERS
    sheet = tmp_path / 'a.csv'
    sheet.write_text('number,answer\n1,Mario\n2,Link\n', encoding='utf-8')
    assert tool.load_answers(str(sheet)) == {1: 'Mario', 2: 'Link'}


# --- Numbering pictures ----------------------------------------------------

def numbered_spots(path, order):
    with pymupdf.open(path) as doc:
        page = doc[0]
        found = tool.number_pictures(page, tool.picture_boxes(page, 20), order, 1)
        return {n: (round(r.x0), round(r.y0)) for n, r in found}


def test_numbers_come_from_the_page(pdfs):
    assert numbered_spots(str(pdfs[0]), 'auto') == SPOTS


def test_falls_back_to_columns_without_printed_numbers(tmp_path):
    path = tmp_path / 'p.pdf'
    make_pictures_pdf(str(path), print_numbers=False)
    assert numbered_spots(str(path), 'auto') == SPOTS
    assert numbered_spots(str(path), 'rows') == {1: SPOTS[1], 2: SPOTS[3], 3: SPOTS[2], 4: SPOTS[4]}


# --- Whole runs ------------------------------------------------------------

def test_page_mode_writes_page_picture_and_questions(pdfs, tmp_path):
    out = tmp_path / 'out'
    tool.main([str(pdfs[0]), str(pdfs[1]), '--out', str(out), '--padding', '0'])
    rows = read_rows(out / 'questions.csv')
    assert [r['Question'] for r in rows] == [
        'Point to Four Of A Kind.', 'Point to The Flag Of Libya.', 'Point to Gin Fizz (Shake) Cocktail.', 'Point to Bop It.']
    assert {r['Pictures'] for r in rows} == {'Page A Alpha p1.png'}
    assert {r['Set'] for r in rows} == {'Page A (Alpha) page 1'}
    assert rows[0]['Explanation'] == 'Four Of A Kind (Poker Hand)'
    # Picture 2 sits at x=60..260, y=300..500 on a 600x560 page.
    assert [float(v) for v in rows[1]['Answer Area'].split(',')] == pytest.approx([10, 53.57, 33.33, 35.71], abs=0.01)
    assert (out / 'Page A Alpha p1.png').exists()

    # The app loads the result and scores a click in the middle of picture 3 as correct.
    data = app_module.load_data(str(out / 'questions.csv'), str(out))
    assert len(data) == 4
    gin = data[2]
    assert app_module.score_answer(gin, 0, 430 / 600, 160 / 560) == (10, 'correct')


def test_split_mode_cuts_pictures_into_groups(pdfs, tmp_path):
    out = tmp_path / 'out'
    tool.main([str(pdfs[0]), str(pdfs[1]), '--out', str(out), '--mode', 'split', '--choices', '2', '--seed', '1'])
    rows = read_rows(out / 'questions.csv')
    assert len(rows) == 4
    assert {r['Question'] for r in rows} == {
        'Which of these is Four Of A Kind?', 'Which of these is The Flag Of Libya?',
        'Which of these is Gin Fizz (Shake) Cocktail?', 'Which of these is Bop It?'}
    for r in rows:
        pictures = r['Pictures'].split(' | ')
        assert len(pictures) == 2
        # The correct picture is the one named after the answer.
        assert pictures[int(r['Correct Picture']) - 1] == tool.safe_name(r['Question'][18:-1]) + '.png'
        assert all((out / name).exists() for name in pictures)
    assert len(app_module.load_data(str(out / 'questions.csv'), str(out))) == 4


def test_custom_wording_and_appending(pdfs, tmp_path):
    out = tmp_path / 'out'
    args = [str(pdfs[0]), str(pdfs[1]), '--out', str(out), '--question', 'Where is #{number}, {answer}?',
            '--category', 'Pic Grid', '--set', 'Alpha']
    tool.main(args)
    tool.main(args)
    rows = read_rows(out / 'questions.csv')
    assert len(rows) == 8
    assert rows[0]['Question'] == 'Where is #1, Four Of A Kind (Poker Hand)?'
    assert rows[0]['Category'] == 'Pic Grid' and rows[0]['Set'] == 'Alpha'
    # The second run saved its page under a new name rather than overwriting the first.
    assert rows[0]['Pictures'] != rows[4]['Pictures']


def test_dry_run_writes_nothing(pdfs, tmp_path):
    out = tmp_path / 'out'
    rows = tool.main([str(pdfs[0]), str(pdfs[1]), '--out', str(out), '--dry-run'])
    assert len(rows) == 4
    assert not out.exists()


def test_folder_pairs_pictures_with_answers(pdfs, tmp_path):
    (tmp_path / 'Notes.pdf').write_bytes(pdfs[1].read_bytes())
    pairs = tool.find_pairs(str(tmp_path))
    assert [(os.path.basename(a), os.path.basename(b)) for a, b in pairs] == [
        ('Page A (Alpha).pdf', 'Page A (Answers-Alpha).pdf')]


def test_missing_answer_is_skipped(tmp_path):
    pictures = tmp_path / 'p.pdf'
    make_pictures_pdf(str(pictures))
    answers = tmp_path / 'a.txt'
    answers.write_text('1 Mario\n3 Link\n', encoding='utf-8')
    rows = tool.main([str(pictures), str(answers), '--out', str(tmp_path / 'out'), '--dry-run'])
    assert [r[1] for r in rows] == ['Point to Mario.', 'Point to Link.']
