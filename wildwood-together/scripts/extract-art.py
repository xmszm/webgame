"""Extract generated white-background atlas via edge-connected background removal.
Pillow required only for asset authoring; not for gameplay or npm validation.
"""
from PIL import Image
from collections import deque
from pathlib import Path
import json

root = Path('public/art')
import sys
items = len(sys.argv) > 1 and sys.argv[1] == 'items'
image = Image.open(Path('evidence/redesign') / ('items-atlas.png' if items else 'forest-atlas.png')).convert('RGBA')
boxes = {'tree': (0, 0, 384, 522), 'tree-sparse': (384, 0, 768, 522),
         'berry': (768, 0, 1152, 510), 'grass': (1152, 0, 1536, 510),
         'rock': (0, 530, 384, 1024), 'sapling': (384, 530, 768, 1024),
         'survivor': (768, 518, 1152, 1024), 'spider': (1152, 530, 1536, 1024)}
if items:
    names = ['item-wood','item-grass','item-stone','item-flint','item-berry','item-axe','item-torch','item-cooked']
    boxes = {name: (i%4*384,i//4*512,(i%4+1)*384,(i//4+1)*512) for i,name in enumerate(names)}
manifest = {}
for name, box in boxes.items():
    crop = image.crop(box)
    w, h = crop.size
    p = crop.load()
    seen = set()
    q = deque([(x, 0) for x in range(w)] + [(x, h-1) for x in range(w)] + [(0, y) for y in range(h)] + [(w-1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        r, g, b, a = p[x, y]
        if min(r, g, b) < 227:
            continue
        p[x, y] = (r, g, b, 0)
        q.extend([(x-1, y), (x+1, y), (x, y-1), (x, y+1)])
    # Preserve enclosed pale face/shirt; remove white antialias contamination only at outer edges.
    for x, y in seen:
        r, g, b, a = p[x, y]
        if a and min(r, g, b) >= 198:
            if any(0 <= nx < w and 0 <= ny < h and p[nx, ny][3] == 0 for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):
                p[x, y] = (r, g, b, max(0, int((255-min(r,g,b))*4)))
    tight = crop.getchannel('A').getbbox()
    crop = crop.crop(tight)
    crop.save(root / f'{name}.png')
    manifest[name] = {'path': f'/art/{name}.png', 'width': crop.width, 'height': crop.height, 'sourceBox': box}
# Preview alpha against the actual game earth, not a checkerboard.
preview = Image.new('RGB', (1200, 740), '#77704d')
for i,(name, entry) in enumerate(manifest.items()):
    asset = Image.open(root / f'{name}.png')
    asset.thumbnail((270,330))
    preview.paste(asset, (i%4*300+(300-asset.width)//2, i//4*370+345-asset.height), asset)
preview.save('evidence/redesign/items-preview.png' if items else 'evidence/redesign/alpha-preview.png')
(root / ('items.json' if items else 'sprites.json')).write_text(json.dumps(manifest, indent=2), encoding='utf8')
print(f'Extracted {len(manifest)} sprites with transparent edge-connected backgrounds')
