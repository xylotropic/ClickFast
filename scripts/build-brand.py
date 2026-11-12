#!/usr/bin/env python3
"""Display the supplied ClickFast artwork without redrawing it."""
from pathlib import Path
import base64
import hashlib
import json

out = Path(__file__).resolve().parents[1] / 'docs/brand'
source = out / 'clickfast-source.png'
data = source.read_bytes()
uri = 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')

def wrapper(viewbox, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" '
            f'aria-label="{title}"><title>{title}</title>'
            f'<image width="1254" height="1254" href="{uri}"/></svg>\n')

(out / 'clickfast-lockup.svg').write_text(wrapper('64 460 1130 340', 'ClickFast'))
(out / 'clickfast-mark.svg').write_text(wrapper('72 480 300 300', 'ClickFast C mark'))
(out / 'source.json').write_text(json.dumps({
    'source': 'clickfast-source.png',
    'provenance': 'Artwork supplied by the user in this conversation',
    'original_dimensions': [1254, 1254],
    'sha256': hashlib.sha256(data).hexdigest(),
    'treatment': 'Original bytes embedded in SVG viewport wrappers; no redraw or recoloring',
}, indent=2) + '\n')
