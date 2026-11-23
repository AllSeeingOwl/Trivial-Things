# Point It Out

A picture quiz where you answer by pointing. Each question shows one or more
pictures: click the right picture, or the right spot on it.

## Playing

```bash
pip install -r requirements.txt
python3 point_it_out_app.py
```

Open <http://127.0.0.1:5010>. Click (or tap) to drop a pin, move it as often as
you like, then press **Lock it in**. Keyboard players can Tab to a picture,
press Enter to drop a pin and move it with the arrow keys (Shift for big steps).

Scoring:

| Result | Points |
| --- | --- |
| Right picture, inside the answer area (or any spot, when the question has no area) | 10 |
| Right picture, within 5% of the answer area | 5 |
| Anything else | 0 |

## Adding questions

Questions live in `Point It Out.csv` (set `CSV_FILE` to use another file):

| Column | Meaning |
| --- | --- |
| Category | Shown above the question. |
| Question | What the player is asked. |
| Pictures | File names in the pictures folder, separated by `\|`. Shown in random order. |
| Correct Picture | Which picture is right, counting from 1. Defaults to 1. |
| Answer Area | Optional `left, top, width, height` in percent of the correct picture. Blank means any click on the right picture counts. |
| Explanation | Shown after the player answers. |
| Set | Optional. Questions with the same set name share their pictures (later rows can leave Pictures blank) and are played one after another, with the pictures kept in the same order. |

### Sets: several questions on the same pictures

Sets give a round some variety:

- **A group of related pictures**, such as four games consoles: "Which is the
  PS3?", "Which came out first?", "Which had a slot-loading disc drive?"
- **One busy picture**, such as a cast photo or a map, with an answer area for
  each question: "Point to Father Dougal", "Point to Mrs Doyle".

In the question maker, fill in the Set name, add the pictures, then use **Save
and write the next question on these pictures** after each question. It keeps
the pictures and set, clears the question, and collects the lines for you to
copy all at once.

The easiest way to write a row is the question maker at
<http://127.0.0.1:5010/editor>: add pictures, click the correct one, drag a box
over the answer, and copy the finished CSV line.

Rows with a missing picture or a bad answer area are skipped, and the server
prints which CSV line was skipped and why.

### Using your own private pictures

Pictures you can't share (photos found online, for example) don't belong in
this repository. Keep them in a private folder, such as a Google Drive folder
synced to your computer with Google Drive for desktop, and point the app at
that folder and at your own question file:

```bash
PICTURES_DIR="~/Google Drive/My Drive/Point It Out Pictures" \
CSV_FILE="~/Google Drive/My Drive/Point It Out Pictures/questions.csv" \
python3 point_it_out_app.py
```

The app then shows only those pictures and questions, and the question maker
lists the files in that folder. Nothing from the folder is copied into the repo.

Pictures can be SVG, PNG, JPEG, GIF or WebP. The starter pictures are simple
SVG drawings made for this app; if you add photos, check you're allowed to use
them, especially if the app is public.

## Tests

```bash
python3 -m pytest
```
