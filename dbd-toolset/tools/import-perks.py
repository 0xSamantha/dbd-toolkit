"""Convert a saved https://dbd.source.gs/perks/ page to the toolkit dataset.
Usage: python3 tools/import-perks.py /path/to/perks.html /path/to/home.html
This importer is pinned to the verified 10.2.0-3840818 snapshot (2026-10-07).
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()
    def text(self):
        content = ''.join(c.text() if isinstance(c, Node) else c for c in self.children)
        if self.tag in ('ul', 'ol'): content = ' ' + content
        return content + (' ' if self.tag in ('br', 'li', 'p', 'ul', 'div') else '')
    def has_class(self, name):
        return name in self.attrs.get('class', '').split()

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = Node()
        self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack[-1].tag == tag:
            self.stack.pop()
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break
    def handle_data(self, data):
        self.stack[-1].children.append(data)

def clean(text):
    return re.sub(r'\s+', ' ', text).strip()

def parse_perks(html):
    page = Page()
    page.feed(html)
    perks = []
    for node in page.root.walk():
        if node.tag != 'a' or 'data-row' not in node.attrs:
            continue
        descendants = list(node.walk())
        description = next(n for n in descendants if n.has_class('gametext'))
        owner = next(n for n in descendants if n.has_class('sub'))
        icon = next(n for n in descendants if n.tag == 'img')
        name = {'Deja Vu': 'Déjà Vu', "We'll make it": "We'll Make It"}.get(node.attrs['data-n'], node.attrs['data-n'])
        desc = clean(description.text())
        tags = []
        for pattern, tag in [(r'\baura', 'aura-reading'), (r'\bgenerator|\brepair', 'generator'), (r'\bheal', 'healing'), (r'\bvault', 'vault'), (r'\bhook', 'hook'), (r'\bhaste|\bfaster', 'speed'), (r'\bexhaust', 'exhaustion'), (r'\bendurance', 'endurance'), (r'\bundetectable|\bsilent|\bquiet', 'stealth'), (r'\bscourge', 'scourge_hook')]:
            if re.search(pattern, desc, re.I):
                tags.append(tag)
        perks.append({
            'id': node.attrs['href'].strip('/').split('/')[-1],
            'name': name,
            'role': 'survivor' if '--survivor' in node.attrs.get('style', '') else 'killer',
            'tags': tags,
            'desc': desc,
            'icon': icon.attrs['src'],
            'tiers': [clean(n.text()) for n in descendants if n.has_class('tv')],
            'meta': {'owner': clean(owner.text()), 'source': 'https://dbd.source.gs'+node.attrs['href']}
        })
    return perks

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: import-perks.py perks.html home.html (verified patch 10.2.0 snapshot)')
    if '10.2.0-3840818' not in Path(sys.argv[2]).read_text():
        raise SystemExit('Home page is not the expected 10.2.0-3840818 build; refusing to mislabel the dataset.')
    perks = parse_perks(Path(sys.argv[1]).read_text())
    assert len(perks) == 321, f'Expected verified snapshot of 321 perks, got {len(perks)}'
    assert len({p['name'].casefold() for p in perks}) == len(perks)
    assert sum(p['role'] == 'killer' for p in perks) == 145
    assert all(p['desc'] and p['icon'].startswith('https://') for p in perks)
    data = {'version': '10.2.0', 'build': '10.2.0-3840818', 'extracted': '2026-10-07',
            'source': 'https://dbd.source.gs/perks/',
            'patchNotes': 'https://bugreport.deadbydaylight.com/projects/pr-5642738318/releases/6012',
            'perks': perks}
    if len(sys.argv) > 2:
        home = Page()
        home.feed(Path(sys.argv[2]).read_text())
        killers = {}
        for node in home.root.walk():
            href = node.attrs.get('href', '')
            if node.tag == 'a' and href.startswith('/killers/') and href != '/killers/':
                killers.setdefault(href, re.sub(r'^The ', '', clean(node.text())))
        assert len(killers) == 44, f'Expected 44 killers, got {len(killers)}'
        data['killers'] = list(killers.values())
    root = Path(__file__).resolve().parent.parent
    serialized = json.dumps(data, ensure_ascii=False, indent=2)
    (root/'perks.txt').write_text(serialized+'\n')
    (root/'dbd-perks.js').write_text('// Patch 10.2.0; source and build metadata are included below.\nconst DBD_PERK_DATA = '+serialized+';\n')
    print(f'Imported {len(perks)} perks (145 killer, 176 survivor), descriptions, tier text, icons and source links.')
