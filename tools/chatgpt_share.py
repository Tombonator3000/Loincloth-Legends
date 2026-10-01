"""Leser en delt ChatGPT-samtale (chatgpt.com/share/...) uten innlogging og skriver den ut som tekst.

Siden viser bare tittelen uten innlogging, men hele samtalen ligger i HTML-en, i strømmen til React Router
(`window.__reactRouterContext.streamController.enqueue(...)`). Den er kodet som en flat liste der objekter
peker på andre plasser i lista med tall ("turbo-stream"). Skriptet pakker den ut og henter meldingene.
Bilder i samtalen vises bare som plassholdere, de kan ikke lastes ned uten innlogging.

Bruk:  python3 tools/chatgpt_share.py <lenke eller lagret .html> [--alt] [--json ut.json]
  --alt   ta med verktøykall, tenkesammendrag og skjulte meldinger (standard er bare det som vises i chatten)
  --json  lagre hele den utpakkede responsen som JSON
"""
import json, re, sys, urllib.request
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    OSLO = ZoneInfo('Europe/Oslo')
except Exception:  # mangler tidssonedata: lokal tid
    OSLO = None

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
# Spesialverdier i turbo-stream: hull, NaN, -uendelig, -0, null, +uendelig, undefined
SPESIAL = {-1: None, -2: float('nan'), -3: float('-inf'), -4: -0.0, -5: None, -6: float('inf'), -7: None}


def hent(kilde):
    if Path(kilde).exists():
        return Path(kilde).read_text(encoding='utf-8')
    req = urllib.request.Request(kilde, headers={'User-Agent': UA, 'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.8'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8')


def pakk_ut(html):
    biter = [json.loads(m) for m in re.findall(r'streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)', html)]
    linje = next((l for b in biter for l in b.split('\n') if l.startswith('[')), None)
    if not linje:
        sys.exit('Fant ikke samtalen i siden. Er lenken riktig, og er samtalen fortsatt delt?')
    flat = json.loads(linje)
    ferdig = {}

    def les(i):
        if i < 0:
            return SPESIAL.get(i)
        if i in ferdig:
            return ferdig[i]
        v = flat[i]
        if isinstance(v, dict):
            ut = ferdig[i] = {}
            for k, vi in v.items():
                ut[flat[int(k[1:])] if k.startswith('_') else k] = les(vi)
            return ut
        if isinstance(v, list):
            if v and isinstance(v[0], str) and len(v[0]) == 1:  # ["D", tid], ["P", id] osv.
                return {'$type': v[0], 'verdi': v[1:]}
            ut = ferdig[i] = []
            ut.extend(les(vi) for vi in v)
            return ut
        ferdig[i] = v
        return v

    rot = les(0)
    for rute in rot.get('loaderData', {}).values():
        if isinstance(rute, dict) and isinstance(rute.get('serverResponse'), dict):
            return rute['serverResponse'].get('data', {})
    sys.exit('Fant strømmen, men ikke selve samtalen (serverResponse).')


def tekst(innhold):
    deler = innhold.get('parts')
    if deler is None:
        return innhold.get('text') or ''
    ut = []
    for d in deler:
        if isinstance(d, str):
            ut.append(d)
        elif isinstance(d, dict) and d.get('content_type') == 'image_asset_pointer':
            ut.append(f"[bilde {d.get('width')}x{d.get('height')}]")
    s = '\n'.join(ut)
    return re.sub('.*?', '', s, flags=re.S)  # kildehenvisninger fra nettsøk


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith('-'):
        sys.exit(__doc__)
    data = pakk_ut(hent(sys.argv[1]))
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(data, ensure_ascii=False, indent=1, default=str), encoding='utf-8')
    alt = '--alt' in sys.argv
    print(f"# {data.get('title')}\n")
    for node in data.get('linear_conversation') or []:
        m = node.get('message') or {}
        rolle = (m.get('author') or {}).get('role')
        innhold = m.get('content') or {}
        type_ = innhold.get('content_type')
        synlig = rolle == 'user' or (rolle == 'assistant' and type_ in ('text', 'multimodal_text') and m.get('recipient') == 'all')
        if (m.get('metadata') or {}).get('is_visually_hidden_from_conversation') or not synlig:
            if not alt:
                continue
        s = tekst(innhold) if type_ in ('text', 'multimodal_text') else json.dumps(innhold, ensure_ascii=False)
        if not s.strip():
            continue
        tid = datetime.fromtimestamp(m['create_time'], OSLO).strftime('%Y-%m-%d %H:%M') if m.get('create_time') else ''
        print(f"## {rolle} ({type_}, {tid})\n\n{s.strip()}\n")


if __name__ == '__main__':
    main()
