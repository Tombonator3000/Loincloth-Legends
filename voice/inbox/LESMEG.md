# Innboks for replikker

Legg replikkene fra VoiceStudio her, med navnet fra manuset i docs/STEMMER.md (for eksempel
`v_they_are_blue_that_is_the_only_difference.wav`). Kjør så:

```bash
python3 tools/make_sounds.py --stemmer
```

Verktøyet klipper stillheten, normaliserer, koder til MP3 i public/assets/sound/, fører dem opp i sound.json og
KILDER.md, og flytter originalene til voice/inbox/behandlet/. Alt i denne mappa utenom denne fila holdes utenfor git.
