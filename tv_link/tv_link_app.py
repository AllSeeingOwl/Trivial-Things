"""TV Link: show photos, messages, YouTube videos, timers and more on a TV, from your phone.

Open /tv in the TV's web browser; it shows a five-letter code and a QR code. Open / on a phone,
type the code (or scan the QR code), and the phone decides what the TV shows. See screens.py.
"""
import io
import os

from flask import Flask, abort, jsonify, render_template, request, send_file
from werkzeug.middleware.proxy_fix import ProxyFix

try:
    from sentry_setup import init_sentry
    from screens import (CODE_LENGTH, MAX_MESSAGE_CHARS, SLIDESHOW_SECONDS, Full, ScreenError,
                         ScreenStore, normalise_code)
except ModuleNotFoundError:
    from tv_link.sentry_setup import init_sentry
    from tv_link.screens import (CODE_LENGTH, MAX_MESSAGE_CHARS, SLIDESHOW_SECONDS, Full,
                                 ScreenError, ScreenStore, normalise_code)

try:
    import segno
except ModuleNotFoundError:  # the QR code is a convenience; the TV still shows the code
    segno = None

# Start Sentry (if SENTRY_DSN is set) before the Flask app is created.
init_sentry("tv_link")

app = Flask(__name__)
app.config['DEBUG'] = False
# Photos are resized on the phone before they're sent, so this is generous.
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
# Render (and most hosts) put one proxy in front of the app: trust it for the visitor's
# address (used to slow down code guessing) and for https in the QR code's link.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

SCREENS = ScreenStore()

YOUTUBE_FRAME = "https://www.youtube-nocookie.com"


@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Only the TV page embeds YouTube; the phone page reads photos through blob: URLs while
    # it shrinks them.
    frames = YOUTUBE_FRAME if request.endpoint == 'tv_page' else "'none'"
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; "
        f"connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'none'; frame-src {frames}; "
        "base-uri 'none'; form-action 'self'")
    return response


def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    return response


def error(message, status):
    return no_store(jsonify({'error': message})), status


def client_address():
    return request.remote_addr or 'unknown'


# --- pages -------------------------------------------------------------------------------

@app.route('/')
def phone_page():
    return no_store(app.make_response(render_template(
        'phone.html', code_length=CODE_LENGTH, max_message=MAX_MESSAGE_CHARS,
        slideshow_seconds=SLIDESHOW_SECONDS)))


@app.route('/tv')
def tv_page():
    return no_store(app.make_response(render_template('tv.html', code_length=CODE_LENGTH)))


@app.route('/qr.svg')
def qr_code():
    """A QR code for the phone page with this TV's code filled in."""
    code = normalise_code(request.args.get('code'))
    if segno is None or len(code) != CODE_LENGTH or not code.isalpha():
        abort(404)
    link = request.host_url + '?code=' + code
    out = io.BytesIO()
    segno.make(link, error='m').save(out, kind='svg', scale=8, border=2, dark='#0b0f18',
                                     light='#ffffff', xmldecl=False, svgns=True)
    out.seek(0)
    return no_store(send_file(out, mimetype='image/svg+xml'))


# --- the TV ------------------------------------------------------------------------------

def tv_screen(code):
    screen = SCREENS.get(code)
    if screen is None:
        return None, error('That TV code has ended.', 404)
    if not SCREENS.is_tv(screen, request.headers.get('X-TV-Token', '')):
        return None, error('This is not the TV for that code.', 403)
    return screen, None


@app.route('/api/screens', methods=['POST'])
def create_screen():
    try:
        screen = SCREENS.create()
    except Full as e:
        return error(str(e), 503)
    return no_store(jsonify({'code': screen.code, 'tv_token': screen.tv_token,
                             'state': SCREENS.view(screen)})), 201


@app.route('/api/screens/<code>/tv')
def tv_state(code):
    screen, err = tv_screen(code)
    if err:
        return err
    return no_store(jsonify(SCREENS.tv_poll(screen)))


@app.route('/api/screens/<code>/tv/end', methods=['POST'])
def tv_end(code):
    screen, err = tv_screen(code)
    if err:
        return err
    SCREENS.end(screen)
    return no_store(jsonify({'ended': True}))


# --- phones ------------------------------------------------------------------------------

def phone_screen(code):
    screen = SCREENS.get(code)
    if screen is None:
        return None, error('That TV code has ended. Check the code on the TV.', 404)
    if not SCREENS.is_phone(screen, request.headers.get('X-Phone-Token', '')):
        return None, error('This phone is no longer connected to that TV. Enter the code again.', 403)
    return screen, None


@app.route('/api/screens/<code>/join', methods=['POST'])
def join(code):
    address = client_address()
    if SCREENS.join_blocked(address):
        return error('Too many wrong codes. Wait a few minutes and try again.', 429)
    screen = SCREENS.get(code)
    if screen is None:
        SCREENS.join_failed(address)
        return error("There's no TV with that code. Check the code on the TV.", 404)
    token = SCREENS.join(screen)
    return no_store(jsonify({'code': screen.code, 'token': token, 'state': SCREENS.view(screen)}))


@app.route('/api/screens/<code>/state')
def phone_state(code):
    screen, err = phone_screen(code)
    if err:
        return err
    return no_store(jsonify(SCREENS.view(screen)))


@app.route('/api/screens/<code>/actions', methods=['POST'])
def phone_action(code):
    screen, err = phone_screen(code)
    if err:
        return err
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error('Send a JSON object.', 400)
    try:
        SCREENS.act(screen, data.get('action'), data)
    except ScreenError as e:
        return error(str(e), 400)
    return no_store(jsonify(SCREENS.view(screen)))


@app.route('/api/screens/<code>/photos', methods=['POST'])
def add_photo(code):
    screen, err = phone_screen(code)
    if err:
        return err
    try:
        photo = SCREENS.add_photo(screen, request.get_data(cache=False))
        if request.args.get('show') == '1':
            SCREENS.act(screen, 'show_photo', {'photo': photo.id})
    except ScreenError as e:
        return error(str(e), 400)
    except Full as e:
        return error(str(e), 503)
    return no_store(jsonify({'photo': photo.id, 'state': SCREENS.view(screen)})), 201


@app.route('/api/screens/<code>/photos/<photo_id>')
def get_photo(code, photo_id):
    """Photo ids are long and random, so the TV's <img> needs no token to load one."""
    screen = SCREENS.get(code)
    photo = SCREENS.photo(screen, photo_id) if screen else None
    if photo is None:
        abort(404)
    response = send_file(io.BytesIO(photo.data), mimetype=photo.mime)
    response.headers['Cache-Control'] = 'private, max-age=3600'
    return response


@app.errorhandler(413)
def too_large(_e):
    return error('That photo is too large.', 413)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '127.0.0.1')
    app.run(debug=False, port=port, host=host, threaded=True)
