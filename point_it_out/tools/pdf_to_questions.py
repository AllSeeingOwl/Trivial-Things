#!/usr/bin/env python3
"""Turn a page of numbered pictures (a PDF) plus its answers into Point It Out questions.

Run this on your own computer. It reads your PDFs and writes pictures and a
questions CSV into a folder you choose (your private pictures folder); nothing
goes anywhere else.

Two modes:

  page   (default) Each PDF page becomes one picture. Every numbered picture on
         it becomes a "point to it" question, with its answer box drawn around
         where that picture sits on the page. Each page is one set.

  split  Each numbered picture is cut out into its own image file. They are then
         dealt into groups (4 by default) and each group becomes a set asking
         "Which of these is ...?" once for each of its pictures.

Examples:

  python3 pdf_to_questions.py "Page A (Alpha).pdf" "Page A (Answers-Alpha).pdf" --out ~/Pictures/PointItOut --dry-run
  python3 pdf_to_questions.py "Page A (Alpha).pdf" "Page A (Answers-Alpha).pdf" --out ~/Pictures/PointItOut
  python3 pdf_to_questions.py --folder "~/Google Drive/My Drive/Bid Pic/20 Pics/Alpha" --out ~/Pictures/PointItOut --mode split

Answers can be a PDF, a .txt file, or a .csv with "number,answer" rows. In a PDF
or text file, each answer is a number followed by its label, on the same line or
the next ("1 Four Of A Kind" or "1" then "Four Of A Kind").

Text options accept these placeholders:
  {answer}  the full answer, e.g. "Gin Fizz (Shake) Cocktail"
  {name}    the answer without a bracketed note at the end, e.g. "Gin Fizz"
  {number}  the picture's number
  {pdf}     the PDF's file name without ".pdf"
  {page}    the page number
"""
import argparse
import csv
import os
import random
import re
import sys

try:
    import pymupdf
except ImportError:  # older PyMuPDF
    import fitz as pymupdf

CSV_HEADER = ['Category', 'Question', 'Pictures', 'Correct Picture', 'Answer Area', 'Explanation', 'Set']
SAFE_CHARS = re.compile(r'[^A-Za-z0-9 ._-]+')
TRAILING_NOTE = re.compile(r'\s*\((?:[^()]|\([^()]*\))*\)\s*$')
NUMBER_LINE = re.compile(r'^\s*(\d{1,3})(?!\d)\s*[.):-]?\s*(.*)$')


# --- Answers ---------------------------------------------------------------

def parse_answer_text(text, max_number=300):
    """Read "number then label" answers from plain text. Returns {number: label}.

    A label can follow its number on the same line or start on the next line,
    and can run over several lines until the next number.
    """
    answers = {}
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = NUMBER_LINE.match(line)
        if m and 1 <= int(m.group(1)) <= max_number and int(m.group(1)) not in answers:
            current = int(m.group(1))
            answers[current] = m.group(2).strip()
        elif current is not None:
            answers[current] = (answers[current] + ' ' + line).strip()
    return {n: ' '.join(label.split()) for n, label in answers.items() if label.strip()}


def load_answers(path):
    lower = path.lower()
    if lower.endswith('.csv'):
        answers = {}
        with open(path, encoding='utf-8') as f:
            for row in csv.reader(f):
                if len(row) >= 2 and row[0].strip().isdigit():
                    answers[int(row[0])] = row[1].strip()
        return answers
    if lower.endswith('.pdf'):
        with pymupdf.open(path) as doc:
            return parse_answer_text('\n'.join(page.get_text() for page in doc))
    with open(path, encoding='utf-8') as f:
        return parse_answer_text(f.read())


# --- Pictures on a page ----------------------------------------------------

def picture_boxes(page, min_size):
    """Rectangles of the pictures drawn on a page, biggest duplicates removed."""
    boxes = []
    for info in page.get_image_info():
        r = pymupdf.Rect(info['bbox']) & page.rect
        if r.is_empty or r.width < min_size or r.height < min_size:
            continue
        if any(abs(r.x0 - b.x0) < 1 and abs(r.y0 - b.y0) < 1 and abs(r.x1 - b.x1) < 1 and abs(r.y1 - b.y1) < 1 for b in boxes):
            continue
        boxes.append(r)
    return boxes


def gap(rect, x, y):
    dx = max(rect.x0 - x, 0, x - rect.x1)
    dy = max(rect.y0 - y, 0, y - rect.y1)
    return (dx * dx + dy * dy) ** 0.5


def number_pictures(page, boxes, order, start):
    """Give each picture box a number. Returns [(number, rect)].

    order "auto" uses numbers printed on the page, matching each picture to the
    closest unused number; if the page has too few printed numbers it falls back
    to "columns". "columns" counts top to bottom, then left to right; "rows"
    counts left to right, then top to bottom. Fallback numbering starts at start.
    """
    if order == 'auto':
        words = [w for w in page.get_text('words') if w[4].strip('.)').isdigit()]
        labels = [(int(w[4].strip('.)')), (w[0] + w[2]) / 2, (w[1] + w[3]) / 2) for w in words]
        if len({n for n, _, _ in labels}) >= len(boxes) > 0:
            pairs = sorted((gap(b, x, y), i, n) for i, b in enumerate(boxes) for n, x, y in labels)
            used_boxes, used_numbers, result = set(), set(), []
            for _, i, n in pairs:
                if i not in used_boxes and n not in used_numbers:
                    used_boxes.add(i)
                    used_numbers.add(n)
                    result.append((n, boxes[i]))
            return sorted(result, key=lambda t: t[0])
        order = 'columns'

    def bands(values, tolerance):
        groups = []
        for v in sorted(values):
            if not groups or v - groups[-1][-1] > tolerance:
                groups.append([v])
            else:
                groups[-1].append(v)
        return {v: i for i, g in enumerate(groups) for v in g}

    tol = min((b.width for b in boxes), default=1) / 2
    col = bands([b.x0 for b in boxes], tol)
    row = bands([b.y0 for b in boxes], min((b.height for b in boxes), default=1) / 2)
    key = (lambda b: (col[b.x0], row[b.y0])) if order == 'columns' else (lambda b: (row[b.y0], col[b.x0]))
    return [(start + i, b) for i, b in enumerate(sorted(boxes, key=key))]


# --- Output ----------------------------------------------------------------

def safe_name(text, limit=80):
    name = SAFE_CHARS.sub('', text).strip(' .-_')
    name = re.sub(r'\s+', ' ', name)[:limit].strip(' .-_')
    return name or 'picture'


def unique_path(folder, base, ext, taken):
    name = base + ext
    i = 2
    while name.lower() in taken or os.path.exists(os.path.join(folder, name)):
        name = f'{base} {i}{ext}'
        i += 1
    taken.add(name.lower())
    return name


def fill(template, **values):
    try:
        return template.format(**values)
    except (KeyError, IndexError) as e:
        sys.exit(f'Unknown placeholder {e} in {template!r}. Use {{answer}}, {{name}}, {{number}}, {{pdf}} or {{page}}.')


def pct(v):
    return f'{v * 100:.2f}'.rstrip('0').rstrip('.')


def convert(pictures_pdf, answers, args, taken):
    """Return CSV rows for one pictures PDF, writing picture files unless dry run."""
    pdf_name = os.path.splitext(os.path.basename(pictures_pdf))[0]
    rows, cut_outs = [], []
    next_number = 1
    with pymupdf.open(pictures_pdf) as doc:
        for page_index, page in enumerate(doc):
            page_no = page_index + 1
            boxes = picture_boxes(page, args.min_size)
            numbered = number_pictures(page, boxes, args.order, next_number)
            next_number += len(numbered)
            print(f'{os.path.basename(pictures_pdf)} page {page_no}: {len(numbered)} pictures')
            if not numbered:
                continue

            values = {'pdf': pdf_name, 'page': page_no}
            page_file = None
            if args.mode == 'page':
                page_file = unique_path(args.out, safe_name(f'{pdf_name} p{page_no}'), '.png', taken)
                if not args.dry_run:
                    page.get_pixmap(dpi=args.dpi).save(os.path.join(args.out, page_file))

            for number, rect in numbered:
                answer = answers.get(number)
                if not answer:
                    print(f'  #{number}: no answer found, skipped')
                    continue
                v = dict(values, number=number, answer=answer, name=TRAILING_NOTE.sub('', answer) or answer)
                print(f'  #{number}: {answer}')
                if args.mode == 'page':
                    pad = args.padding
                    r = pymupdf.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad) & page.rect
                    w, h = page.rect.width, page.rect.height
                    area = ', '.join(pct(x) for x in ((r.x0 - page.rect.x0) / w, (r.y0 - page.rect.y0) / h, r.width / w, r.height / h))
                    rows.append([fill(args.category, **v), fill(args.question, **v), page_file, '1', area,
                                 fill(args.explanation, **v), fill(args.set, **v)])
                else:
                    file_name = unique_path(args.out, safe_name(v['name']), '.png', taken)
                    if not args.dry_run:
                        page.get_pixmap(dpi=args.dpi, clip=rect).save(os.path.join(args.out, file_name))
                    cut_outs.append((file_name, v))

    if args.mode == 'split':
        rows.extend(group_rows(cut_outs, args))
    return rows


def group_rows(cut_outs, args):
    """Deal cut-out pictures into sets of args.choices, one question per picture."""
    items = cut_outs[:]
    random.Random(args.seed).shuffle(items)
    size = max(2, args.choices)
    groups = [items[i:i + size] for i in range(0, len(items), size)]
    # Fold a lone leftover picture into the previous group rather than ask about one picture.
    if len(groups) > 1 and len(groups[-1]) == 1:
        groups[-2].extend(groups.pop())
    rows = []
    for g_index, group in enumerate(groups, 1):
        pictures = ' | '.join(name for name, _ in group)
        for correct, (_, v) in enumerate(group, 1):
            v = dict(v, group=g_index)
            set_name = fill(args.split_set, **v) if len(group) > 1 else ''
            rows.append([fill(args.category, **v), fill(args.split_question, **v), pictures, str(correct), '',
                         fill(args.explanation, **v), set_name])
    return rows


def find_pairs(folder):
    """Pair each pictures PDF with the answers PDF whose name differs only by "Answers"."""
    pdfs = [f for f in os.listdir(folder) if f.lower().endswith('.pdf')]

    def key(name):
        name = re.sub(r'answers?', '', os.path.splitext(name)[0], flags=re.I)
        return re.sub(r'[^a-z0-9]', '', name.lower())

    answers = {key(f): f for f in pdfs if re.search(r'answers?', f, re.I)}
    pairs = []
    for f in sorted(pdfs):
        if re.search(r'answers?', f, re.I):
            continue
        match = answers.get(key(f))
        if match:
            pairs.append((os.path.join(folder, f), os.path.join(folder, match)))
        else:
            print(f'No answers PDF found for {f}, skipped')
    return pairs


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('pictures', nargs='?', help='PDF of numbered pictures')
    p.add_argument('answers', nargs='?', help='answers as a PDF, .txt or .csv')
    p.add_argument('--folder', help='instead of naming two files, pair every pictures PDF in this folder with its answers PDF')
    p.add_argument('--out', required=True, help='folder to write pictures and the CSV into (your private pictures folder)')
    p.add_argument('--csv', default='questions.csv', help='CSV file name inside --out (default: questions.csv)')
    p.add_argument('--replace', action='store_true', help='overwrite the CSV instead of adding to it')
    p.add_argument('--mode', choices=['page', 'split'], default='page', help='point to it on the page, or cut pictures out (default: page)')
    p.add_argument('--order', choices=['auto', 'columns', 'rows'], default='auto',
                   help='how pictures are numbered: from numbers printed on the page, or by position (default: auto)')
    p.add_argument('--category', default='{pdf}', help='category text (default: "{pdf}")')
    p.add_argument('--question', default='Point to {name}.', help='question text in page mode (default: "Point to {name}.")')
    p.add_argument('--set', default='{pdf} page {page}', help='set name in page mode (default: "{pdf} page {page}")')
    p.add_argument('--split-question', default='Which of these is {name}?', help='question text in split mode')
    p.add_argument('--split-set', default='{pdf} group {group}', help='set name in split mode ({group} is the group number)')
    p.add_argument('--explanation', default='{answer}', help='text shown after answering (default: "{answer}")')
    p.add_argument('--choices', type=int, default=4, help='pictures per group in split mode (default: 4)')
    p.add_argument('--seed', type=int, default=None, help='fix the split-mode grouping so reruns match')
    p.add_argument('--padding', type=float, default=2, help='points of slack around each answer box in page mode (default: 2)')
    p.add_argument('--dpi', type=int, default=150, help='resolution of saved pictures (default: 150)')
    p.add_argument('--min-size', type=float, default=20, help='ignore images smaller than this many points, like logos (default: 20)')
    p.add_argument('--dry-run', action='store_true', help='show what would be made without writing anything')
    args = p.parse_args(argv)

    args.out = os.path.abspath(os.path.expanduser(args.out))
    if args.folder:
        pairs = find_pairs(os.path.expanduser(args.folder))
    elif args.pictures and args.answers:
        pairs = [(os.path.expanduser(args.pictures), os.path.expanduser(args.answers))]
    else:
        p.error('give a pictures PDF and its answers, or --folder')
    if not pairs:
        sys.exit('Nothing to convert.')
    if not args.dry_run:
        os.makedirs(args.out, exist_ok=True)

    taken, rows = set(), []
    for pictures_pdf, answers_path in pairs:
        answers = load_answers(answers_path)
        print(f'{os.path.basename(answers_path)}: {len(answers)} answers')
        rows.extend(convert(pictures_pdf, answers, args, taken))

    csv_path = os.path.join(args.out, args.csv)
    if args.dry_run:
        print(f'\nDry run: would write {len(rows)} questions to {csv_path}')
        writer = csv.writer(sys.stdout, lineterminator='\n')
        writer.writerow(CSV_HEADER)
        writer.writerows(rows)
        return rows

    new_file = args.replace or not os.path.exists(csv_path)
    with open(csv_path, 'w' if new_file else 'a', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        if new_file:
            writer.writerow(CSV_HEADER)
        writer.writerows(rows)
    print(f'\nWrote {len(rows)} questions to {csv_path}')
    return rows


if __name__ == '__main__':
    main()
