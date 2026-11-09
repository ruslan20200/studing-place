"""Create a self-contained web library; keep the complete extraction untouched.

Run with a Python environment containing Pillow:
  python scripts/prepare-hosted-library.py --books /path/to/parsed-data/books
Original PDFs are copied from the existing public/originals links.
"""
import argparse
import hashlib
import json
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--books', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
public = root / 'public'
catalog = json.loads((public / 'data/catalog.json').read_text())
(root / '.logs').mkdir(exist_ok=True)


def convert(pair):
    source, target = pair
    with Image.open(source) as image:
        image.convert('RGB').save(target, format='WEBP', quality=85, method=4)


with tempfile.TemporaryDirectory(prefix='hosting-library-', dir=root / '.logs') as temporary:
    stage = Path(temporary)
    library, originals = stage / 'library', stage / 'originals'
    library.mkdir()
    originals.mkdir()
    jobs = []
    for book in catalog:
        source = args.books.resolve() / book['id']
        target = library / book['id']
        target.mkdir()
        for filename in ('metadata.json', 'images.json', 'toc.json', 'tables.json'):
            shutil.copy2(source / filename, target / filename)
        shutil.copytree(source / 'assets', target / 'assets')
        pages = json.loads((source / 'pages.json').read_text())
        (target / 'renders').mkdir()
        renders = {}
        for page in pages:
            if page.get('render'):
                before = page['render']
                after = str(Path(before).with_suffix('.webp'))
                renders[before] = after
                page['render'] = after
        for before, after in renders.items():
            jobs.append((source / before, target / after))
        (target / 'pages.json').write_text(json.dumps(pages, ensure_ascii=False))
        pdf = public / 'originals' / book['filename']
        expected = json.loads((source / 'metadata.json').read_text())['sha256']
        if hashlib.sha256(pdf.read_bytes()).hexdigest() != expected:
            raise ValueError('Original PDF checksum mismatch: ' + book['id'])
        shutil.copy2(pdf, originals / book['filename'])
    with ThreadPoolExecutor(max_workers=4) as pool:
        for index, _ in enumerate(pool.map(convert, jobs), 1):
            if index % 200 == 0:
                print(f'Prepared {index}/{len(jobs)} page images', flush=True)
    for name in ('library', 'originals'):
        existing = public / name
        if existing.is_symlink():
            existing.unlink()
        else:
            shutil.rmtree(existing)
        shutil.move(str(stage / name), existing)
    size = sum(p.stat().st_size for name in ('library', 'originals') for p in (public / name).rglob('*') if p.is_file())
    print(json.dumps({'books': len(catalog), 'page_images': len(jobs), 'library_bytes': size,
                      'resolution': 'unchanged', 'original_pdfs': 'checksum verified; unchanged'}))
