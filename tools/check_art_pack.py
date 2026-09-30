"""Kontroller grunnpakkens 143 filer og eventuelle ekstra forge_-figurdeler.

Bruk: python3 tools/check_art_pack.py (krever Pillow).
"""
import json, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'public' / 'assets'
manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))

six = {'head', 'torso', 'pelvis', 'arm', 'leg', 'weapon'}
five = six - {'weapon'}
expected_parts = {('valkyra', p) for p in six | {'hairback'}}
expected_parts |= {(c, p) for c in ('thrugg', 'gorthak', 'skeleton', 'hogman', 'cultist',
                                    'imp', 'frogman', 'troll', 'vorthax') for p in six}
expected_parts |= {(c, p) for c in ('gnome', 'zombie', 'fireimp', 'magmor') for p in five}
expected_parts |= {('croakus', p) for p in ('head', 'torso', 'pelvis', 'leg', 'weapon')}
expected_parts |= {('hogmother', p) for p in ('head', 'torso', 'weapon')}
expected_parts |= {(c, p) for c in ('warhog', 'cluckatrice', 'magmanewt')
                   for p in ('body', 'head', 'tail', 'leg')}
expected_parts |= {(f'pet_{c}', 'body') for c in ('eyeball', 'rat', 'skull', 'chicken', 'dragon')}

expected_textures = {f'{kind}_{biome}' for kind in ('ground', 'road')
                     for biome in ('grass', 'swamp', 'frost', 'scorch', 'night')}
expected_textures |= {'wall_keep', 'wall_gate', 'wood', 'floor_tower', 'wall_tower', 'pillar_tower'}
expected_textures |= {f'{kind}_arena-{theme}' for kind in ('floor', 'sand', 'wall', 'pillar')
                      for theme in ('pit', 'ice', 'bone')}
expected_sky = {'grass', 'swamp', 'frost', 'scorch', 'night',
                'arena-pit', 'arena-ice', 'arena-bone'}

parts = manifest['parts']
actual_parts = {(p['char'], p['part']) for p in parts}
assert len(parts) == len(actual_parts), 'Doble figurdeler i manifestet'
missing_parts = expected_parts - actual_parts
extra_parts = actual_parts - expected_parts
forge_parts = {(char, part) for char, part in extra_parts
               if char.startswith('forge_') and len(char) > len('forge_')
               and part in six | {'hairback'}}
assert not missing_parts, f'Mangler {missing_parts}'
assert extra_parts == forge_parts, f'Ukjente ekstra figurdeler: {extra_parts - forge_parts}'
assert set(manifest['textures']) == expected_textures
assert set(manifest['sky']) == expected_sky
assert manifest['map'] == 'map.webp'

names = [p['file'] for p in parts] + list(manifest['textures'].values())
names += list(manifest['sky'].values()) + [manifest['map']]
appearance = manifest.get('appearance', [])
assert len(appearance) == len({a['id'] for a in appearance}), 'Doble utseendelag i manifestet'
assert all(re.fullmatch(r'appearance_(hair|beard|headgear|eye)_[a-z0-9_]+', a['id']) for a in appearance), 'Ukjent utseendelag'
names += [a['file'] for a in appearance]
assert len(names) == len(set(names)) == 143 + len(forge_parts) + len(appearance), 'Feil antall eller doble filnavn'
part_files = {p['file'] for p in parts} | {a['file'] for a in appearance}
for name in names:
    path = ASSETS / name
    assert path.is_file() and path.stat().st_size > 0, f'Mangler/er tom: {name}'
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        assert image.format == 'WEBP', f'Ikke WebP: {name}'
        if name in part_files:
            assert image.mode == 'RGBA', f'Mangler alfa: {name}'
        elif name.startswith('tex_'):
            assert image.size == (1024, 1024), f'Feil teksturstorrelse: {name}'
        elif name.startswith('sky_') or name == 'map.webp':
            assert image.size == (1536, 1024), f'Feil panoramastorrelse: {name}'
        else:
            assert image.mode == 'RGBA', f'Mangler alfa: {name}'

print('OK: 89 figurdeler, 12 ridedyrdeler, 5 kjaeledyr, 28 teksturer, 8 himler og kart (143 filer).')
if forge_parts:
    print(f'OK: {len(forge_parts)} ekstra Hero Forge-deler ({len(names)} filer totalt).')
if appearance:
    print(f'OK: {len(appearance)} separate hår-, skjegg-, hodeplagg- og øyelag.')
