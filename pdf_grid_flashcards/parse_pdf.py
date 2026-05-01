import fitz
import json
import os

def extract_grid():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_path = os.path.join(base_dir, "BBC's Big Read.pdf")
    doc = fitz.open(pdf_path)
    page = doc.load_page(1)

    words = page.get_text("words")
    # Filter out title
    words = [w for w in words if w[1] > 80]

    cols = [(0, 160), (160, 330), (330, 500), (500, 670), (670, 850)]
    rows = [(80, 160), (160, 240), (240, 310), (310, 390), (390, 470)]

    grid = [[[] for _ in range(5)] for _ in range(5)]

    for w in words:
        x_c = (w[0] + w[2]) / 2
        y_c = (w[1] + w[3]) / 2

        c_idx, r_idx = -1, -1
        for i, (xmin, xmax) in enumerate(cols):
            if xmin <= x_c <= xmax: c_idx = i
        for i, (ymin, ymax) in enumerate(rows):
            if ymin <= y_c <= ymax: r_idx = i

        if c_idx != -1 and r_idx != -1:
            grid[r_idx][c_idx].append(w)

    # We found that drawings don't align with these boxes directly or maybe they do?
    # Let's check text colors!
    # Text colors can tell us if the background is green or red?
    # Actually wait. White text = incorrect, Black text = correct? Or white text = green background?
    # The previous test output was:
    # Page 2 - Text: 'Charlotte's Web by E. B. ', Color: 0xffffff (White)
    # Page 2 - Text: 'Good Omens by Terry ', Color: 0x0 (Black)
    # But wait, what if the background is light green so text is black, and red is dark so text is white?

    # Let's extract spans to see color
    text_blocks = page.get_text("dict")["blocks"]
    colored_text_rects = []

    for b in text_blocks:
        if "lines" in b:
            for line in b["lines"]:
                for span in line["spans"]:
                    color = span.get("color", 0)
                    text = span.get("text", "").strip()
                    if text:
                        # 0xffffff = 16777215
                        status = "incorrect" if color == 16777215 else "correct"
                        colored_text_rects.append({"rect": fitz.Rect(span["bbox"]), "status": status, "text": text})

    # We can match colored_text_rects to cells!
    grid_data = [[{} for _ in range(5)] for _ in range(5)]

    for r in range(5):
        for c in range(5):
            cell_words = grid[r][c]
            cell_words.sort(key=lambda w: (w[1], w[0]))

            lines = []
            if cell_words:
                current_line = [cell_words[0]]
                current_y = cell_words[0][1]
                for w in cell_words[1:]:
                    if w[1] - current_y < 12:
                        current_line.append(w)
                    else:
                        current_line.sort(key=lambda w: w[0])
                        lines.append(current_line)
                        current_line = [w]
                        current_y = w[1]
                if current_line:
                    current_line.sort(key=lambda w: w[0])
                    lines.append(current_line)

            text = " ".join(" ".join(w[4] for w in line) for line in lines).strip()

            # Determine color from text color inside this cell
            cell_box = fitz.Rect(cols[c][0], rows[r][0], cols[c][1], rows[r][1])
            status = "unknown"
            # find overlapping text rects
            for tr in colored_text_rects:
                if cell_box.intersects(tr["rect"]):
                    if len(tr["text"]) > 3: # Ignore tiny noise
                        status = tr["status"]
                        break

            grid_data[r][c] = {"text": text, "status": status}
            print(f"Row {r} Col {c} [{status}] {text}")

    json_path = os.path.join(base_dir, "grid_data.json")
    with open(json_path, "w") as f:
        json.dump(grid_data, f, indent=2)

if __name__ == "__main__":
    extract_grid()
