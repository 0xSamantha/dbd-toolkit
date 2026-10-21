"""Import toolbox/med-kit data from a saved dbd.source.gs/items/ HTML page."""
import json, re, runpy, sys
from pathlib import Path
parser=runpy.run_path(str(Path(__file__).with_name('import-perks.py')),run_name='parser')
html=Path(sys.argv[1]).read_text()
if '10.2.0-3840818' not in html: raise SystemExit('Expected the verified 10.2.0-3840818 item snapshot.')
page=parser['Page']();page.feed(html);clean=parser['clean']
rows=[]
for node in page.root.walk():
    search=node.attrs.get('data-s','')
    if 'data-row' not in node.attrs or not (search.startswith('med-kits ') or search.startswith('toolboxes ')):continue
    children=list(node.walk());desc=clean(next(n for n in children if n.has_class('gametext')).text())
    rarity=clean(next(n for n in children if n.has_class('sub')).text())
    get=lambda pattern: float(re.search(pattern,desc,re.I).group(1)) if re.search(pattern,desc,re.I) else 0
    row={'id':node.attrs['id'],'name':node.attrs['data-n'],'kind':'medkit' if search.startswith('med-kits ') else 'toolbox',
         'addon':'add-on' in search,'description':desc,'rarity':rarity,'icon':next(n.attrs['src'] for n in children if n.tag=='img')}
    row['effects']={'charges':get(r'Adds (\d+) charges') if row['addon'] else get(r'(\d+) charges'),
        'repair':get(r'Increases (?:the )?(?:Toolbox(?:\x27s)? )?repair speed by (\d+)%'),
        'sabotage':get(r'Increases (?:the )?(?:Toolbox(?:\x27s)? )?sabotage speed by (\d+)%'),
        'heal':get(r'Increases healing speed by (\d+)%'),
        'healOthers':get(r'speed that you heal others by (\d+)%'),
        'selfEfficiency':get(r'efficiency when healing yourself with a Medkit by (\d+)%'),
        'hookRespawn':get(r'extra (\d+) seconds to respawn'),
        'genReduction':get(r'required charges are reduced by (\d+)'),
        'consumes':'Consumes the Med-kit' in desc,
        'skillChecks':bool(re.search(r'skill check',desc,re.I))}
    rows.append(row)
assert len(rows)==43,(len(rows),'expected 18 items and 25 add-ons')
assert sum(not r['addon'] and r['kind']=='medkit' for r in rows)==8
assert sum(not r['addon'] and r['kind']=='toolbox' for r in rows)==10
assert all(r['effects']['charges']>0 for r in rows if not r['addon'])
lookup={r['name']:r for r in rows}
assert lookup["Engineer's Toolbox"]['effects']['repair']==100
assert lookup['Socket Swivels']['effects']['repair']==30
assert lookup['Hacksaw']['effects']['sabotage']==30
assert lookup['Styptic Agent']['effects']['selfEfficiency']==15
out={'version':'10.2.0','build':'10.2.0-3840818','source':'https://dbd.source.gs/items/','items':rows}
(Path(__file__).resolve().parent.parent/'dbd-items-data.js').write_text('// Extracted item snapshot; regenerate with tools/import-items.py.\nconst DBD_ITEMS = '+json.dumps(out,ensure_ascii=False,indent=2)+';\n')
print('Imported 18 items and 25 add-ons from patch 10.2.0 snapshot.')
