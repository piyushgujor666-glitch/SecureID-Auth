import fitz
from pathlib import Path
pdf = Path('attached_assets/Assignment_1789828469048.pdf')
out = Path('.agents/outputs/assignment-pages')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(pdf)
print('pages', doc.page_count, 'metadata', doc.metadata)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False)
    path = out / f'page-{i+1}.png'
    pix.save(path)
    print(path, pix.width, pix.height, 'text_chars', len(page.get_text()))
