# Beskjed til GPT om figurene (30. september 2026)

Riggen er endret, så nye deler til heltesmia (og nye figurer) må tegnes etter nye regler. Kort fortalt:

- Våpenarmen henger nå fra den nære skulderen, som er til venstre i overkroppsbildet, og tegnes foran brystet. Den andre armen henger fra den fjerne skulderen til høyre og ligger bak overkroppen.
- Hodet ligger bak overkroppen, så halsen går inn under kragen. Hoder med langt skjegg ligger foran (`"front": true`).
- Halsen hører til hodet. En ny overkropp skal ikke ha halsstump.
- Hver overkropp får målte skulderledd og halsrot i manifestet (`shoulders` og `neck`). Riggen fester armene og hodet akkurat der.
- PR #2 og #3 (delepoolen og ork- og frostdelene) er slått sammen med dette i main. De fire overkroppene fra smia har fått målte `shoulders` og `neck`, og alle blandingene i artcheck og hero-forge-testen er grønne.

Kopier alt i kodeblokken under og send det til GPT (Codex) før den lager flere deler. Reglene står også i `docs/CHATGPT_PROMPT.md` (del 3, 8.2, 8.4, 8.6 og 13), så en ny ChatGPT-samtale med startprompten får dem automatisk.

````text
UPDATE FROM THE GAME CODE (30 September): how the figures are assembled now. Follow it for every new part, including the Hero Forge parts in docs/HERO_FORGE_GRAFIKK.md.

0. Start from main. Your part pool (PR #2 and #3) is merged there together with a new rig: arms, head, neck, manifest fields, attack poses and the art rules in docs/CHATGPT_PROMPT.md (sections 3, 8.2, 8.4, 8.6 and 13). Pull main before you make or register new parts. The four forge torsos already have measured "shoulders" and "neck".

1. View. Every character stands in 3/4 view facing right. The near shoulder (the character's right shoulder) is on the LEFT side of the torso image. The weapon arm hangs from there and is drawn in front of the chest. The far arm hangs from the RIGHT shoulder and is drawn behind the torso.

2. Torso.
   - No neck. Stop at the neckline, collar or trapezius, about 12% below the top of the image. The head brings its own neck, which goes in behind the collar. A neck column, cylinder or ball on top of the torso shows in front of the head's neck.
   - Near shoulder (left): a rounded shoulder or a flat, plain socket no wider than the arm's shoulder cap (about 10 to 12% of the torso width), centred about 9% in from the left edge and about 30% down. No knobs, balls or tubes sticking out.
   - Far shoulder (right): a plain rounded shoulder about 8% in from the right edge.
   - Forge torsos must mix with thrugg_torso and valkyra_torso: same framing and scale, the neck base 12% below the top, the waist at the bottom edge about half as wide as the torso is tall, nothing sticking up above the shoulders.

3. Head. The whole neck down to a smooth rounded base. It is placed behind the torso, so this neck is what shows above the collar: give it the character's full neck width. Nothing hangs below the bottom of the neck, except a LONG BEARD, which also gets "front": true in the manifest.

4. Arm. One arm hanging straight down, used for both sides. The shoulder cap at the top is at least as wide as the socket on the torso, because it has to cover it. The fist is the lowest point, knuckles facing right, curled round an empty grip.

5. Weapon. Perfectly vertical, head or blade up, a plain narrow handle where the fist holds it, the handle end the lowest point. The game finds the grip on the handle itself.

6. Manifest. After processing, MEASURE every new torso in the trimmed image (0 to 1, y from the top) and add:
   "shoulders": [[near x, near y], [far x, far y]]   near = the left socket. Put the near point in the upper part of the socket: the arm hangs down from it and its cap must cover the socket.
   "neck": [x, 0.12]   the centre of the neck base where the head attaches. Only if a neck stub sticks up anyway: add its half width as a third value, [x, 0.12, r], and the game fades the stub out.
   Heads with a long beard: "front": true. Arms whose fist is not the lowest point: "hand": [x, y].
   process_art.py deletes shoulders, neck and hand when a part gets a new image, because they belong to the old one. Measure again.

7. Check before you commit: npm run typecheck, npm run build, python3 tools/check_art_pack.py, node tools/tests/hero-forge.mjs http://localhost:4173/ and node tools/tests/artcheck.mjs http://localhost:4173/ ./shots. Add every new forge torso to the mixes in artcheck. Look at the gallery in ./shots: the blue dot is the weapon shoulder, red the fist, green the neck. The weapon arm must cover the socket, the head must sit on its neck, and the weapon must sit in the fist.

8. Existing art to redo when there is time:
   - hogmother_torso: cut off along the right edge of the image (499 of 591 rows reach the edge).
   - imp_arm: the arm is thinner than the shoulder knob on imp_torso, so part of the knob shows.
   - gorthak_arm: the shoulder cap is narrower than the socket under the pauldron on gorthak_torso.
   - All the old torsos, and the four forge torsos, have neck columns. They work now (the game fades them out), but new versions should follow rule 2.
   - forge_leather_torso and forge_frost_torso have a cut cylinder socket on the near shoulder. The arms cover it at rest, but a rounded shoulder (rule 2) is safer when the arm swings.
````
