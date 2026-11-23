"""The page's CSP (script-src 'self'; style-src 'self') blocks inline handlers and styles,
so the template must not use them or the buttons stop working."""
import re

from mcq_flashcards.mcq_flashcards_app import app


def test_index_has_no_inline_handlers_or_styles():
    html = app.test_client().get('/').get_data(as_text=True)
    csp = app.test_client().get('/').headers.get('Content-Security-Policy', '')
    assert "'unsafe-inline'" not in csp
    assert not re.search(r'\son[a-z]+\s*=', html), "inline event handler found"
    assert not re.search(r'\sstyle\s*=', html), "inline style attribute found"
    assert not re.search(r'<script>(?!\s*</script>)', html), "inline script found"
