import os
import fitz
from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
# Sentinel: Limit upload size to 16MB to prevent DoS attacks
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def parse_pdf(filepath):
    doc = fitz.open(filepath)
    best_page = None
    max_rects = 0
    # ⚡ Bolt Optimization: Cache expensive PyMuPDF API call
    # Prevent calling get_drawings() twice for the best page by caching it here.
    best_drawings = None

    for page in doc:
        drawings = page.get_drawings()
        rects_count = 0
        for d in drawings:
            fill = d.get("fill")
            if fill:
                r, g, b = fill
                if (g > r and g > b) or (r > g and r > b):
                    rects_count += 1
        if rects_count > max_rects:
            max_rects = rects_count
            best_page = page
            best_drawings = drawings

    if not best_page:
        best_page = doc.load_page(0)
        best_drawings = best_page.get_drawings()

    page = best_page
    words = page.get_text("words")
    drawings = best_drawings

    colored_rects = []
    for d in drawings:
        fill = d.get("fill")
        rect = d.get("rect")
        if fill:
            r, g, b = fill
            is_green = g > r and g > b
            is_red = r > g and r > b
            if is_green or is_red:
                colored_rects.append({"rect": rect, "status": "correct" if is_green else "incorrect"})

    merged_cells = []
    for c in colored_rects:
        merged = False
        for mc in merged_cells:
            if abs((c["rect"].x0 + c["rect"].x1)/2 - (mc["rect"].x0 + mc["rect"].x1)/2) < 50:
                if abs((c["rect"].y0 + c["rect"].y1)/2 - (mc["rect"].y0 + mc["rect"].y1)/2) < 40:
                    mc["rect"] |= c["rect"]
                    merged = True
                    break
        if not merged:
            merged_cells.append({"rect": c["rect"], "status": c["status"]})

    if not merged_cells:
        return []

    x_centers = sorted(list(set([(c["rect"].x0 + c["rect"].x1)/2 for c in merged_cells])))
    cols_x = []
    curr = []
    for x in x_centers:
        if not curr:
            curr.append(x)
        elif x - curr[-1] < 40:
            curr.append(x)
        else:
            cols_x.append(sum(curr)/len(curr))
            curr = [x]
    if curr: cols_x.append(sum(curr)/len(curr))

    y_centers = sorted(list(set([(c["rect"].y0 + c["rect"].y1)/2 for c in merged_cells])))
    rows_y = []
    curr = []
    for y in y_centers:
        if not curr:
            curr.append(y)
        elif y - curr[-1] < 40:
            curr.append(y)
        else:
            rows_y.append(sum(curr)/len(curr))
            curr = [y]
    if curr: rows_y.append(sum(curr)/len(curr))

    grid = [[{"status": "unknown", "words": []} for _ in range(len(cols_x))] for _ in range(len(rows_y))]

    for c in merged_cells:
        x_c = (c["rect"].x0 + c["rect"].x1)/2
        y_c = (c["rect"].y0 + c["rect"].y1)/2
        c_idx = min(range(len(cols_x)), key=lambda i: abs(cols_x[i] - x_c))
        r_idx = min(range(len(rows_y)), key=lambda i: abs(rows_y[i] - y_c))
        grid[r_idx][c_idx]["status"] = c["status"]

    for w in words:
        if w[1] < rows_y[0] - 40:
            continue
        x_c = (w[0] + w[2])/2
        y_c = (w[1] + w[3])/2
        c_idx = min(range(len(cols_x)), key=lambda i: abs(cols_x[i] - x_c))
        r_idx = min(range(len(rows_y)), key=lambda i: abs(rows_y[i] - y_c))
        grid[r_idx][c_idx]["words"].append(w)

    grid_data = []
    for r in range(len(rows_y)):
        row_data = []
        for c in range(len(cols_x)):
            cell_words = grid[r][c]["words"]
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
            text = text.replace("\n", " ")
            row_data.append({"text": text, "status": grid[r][c]["status"]})
        grid_data.append(row_data)

    return grid_data

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and file.filename.lower().endswith('.pdf'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            grid_data = parse_pdf(filepath)
            return jsonify({'grid': grid_data})
        except Exception as e:
            # Sentinel: Log actual error but return generic message to avoid leaking internals
            print(f"Security/Error processing PDF: {e}")
            return jsonify({'error': 'An error occurred while processing the file.'}), 500
        finally:
            # Clean up the file to prevent uploads/ from growing indefinitely
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass

    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

if __name__ == '__main__':
    # Sentinel: Disable debug mode to prevent Werkzeug debugger RCE in production
    app.run(debug=False, port=5002, host='0.0.0.0')
