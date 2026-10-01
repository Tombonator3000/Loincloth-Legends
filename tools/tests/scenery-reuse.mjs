// Eksisterende miljøbilder i tre brett: riktige sett, forhåndslasting og fri vei for begge spillere.
// Bruk: node tools/tests/scenery-reuse.mjs (Node 22.13+). Visuell kontroll gjøres med todo-visuals.mjs.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const ts = (path) => stripTypeScriptTypes(read(path));
const hazardsUrl = moduleUrl(ts('src/data/hazards.ts'));
const { chasmHole } = await import(hazardsUrl);
const { LEVELS } = await import(moduleUrl(ts('src/data/levels.ts').replace("'./hazards'", JSON.stringify(hazardsUrl))));
const { validateLayout, layoutPropIds, layoutToJson, levelWithLayout, LAYERS, LANE_Z } = await import(moduleUrl(ts('src/data/layout.ts')));
const manifest = JSON.parse(read('public/assets/manifest.json'));
const known = new Set(Object.keys(manifest.props));
const additions = {
  road: ['p57', 'p58'],
  jungle: ['p1', 'p2', 'p3'],
  frost: ['p21', 'p22'],
};
const reused = new Set();

for (const [id, ids] of Object.entries(additions)) {
  const source = read(`src/data/layouts/${id}.json`), layout = JSON.parse(source);
  assert.deepEqual(validateLayout(layout, known), [], `${id}: gyldig brettfil og kjente bilder`);
  assert.equal(layoutToJson(layout), source, `${id}: behold editorens filformat`);
  assert.deepEqual(levelWithLayout(LEVELS[id], layout), LEVELS[id], `${id}: kulisser endrer ikke bølger, farer eller ridedyr`);
  const used = new Set(layoutPropIds(layout));

  for (const idInLayout of ids) {
    const p = layout.props.find((item) => item.id === idInLayout);
    assert.ok(p, `${id}/${idInLayout}: plasseringen finnes`);
    const meta = manifest.props[p.prop];
    reused.add(p.prop);
    assert.ok(used.has(p.prop), `${id}/${p.id}: med i spillets bildeliste før editoren åpnes`);
    assert.ok(statSync(new URL(`public/assets/${meta.file}`, root)).size > 0, `${p.prop}: bildefila finnes`);
    assert.equal(p.layer, 'back', `${id}/${p.id}: bak kampfeltet`);
    assert.ok(p.z >= LAYERS.back.z[0] && p.z <= LAYERS.back.z[1], `${id}/${p.id}: riktig dybdelag`);

    // Ta med bredden som en skråstilt port får i dybden, samt usymmetriske bildeankere.
    const width = meta.w * (p.scale ?? 1), anchor = meta.anchor[0];
    const reach = width * Math.max(anchor, 1 - anchor);
    const depth = reach * Math.abs(Math.sin((p.yaw ?? 0) * Math.PI / 180));
    assert.ok(p.z + depth <= LANE_Z[0] - 1, `${id}/${p.id}: minst én meter bak hele 1P/2P-kampfeltet`);
    assert.ok(p.x - reach >= 0 && p.x + reach <= LEVELS[id].length, `${id}/${p.id}: innenfor brettet`);
    for (const h of LEVELS[id].hazards ?? []) {
      const hole = h.kind === 'chasm' ? chasmHole(h) : { x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 };
      const overlapX = p.x + reach > hole.x0 - 0.5 && p.x - reach < hole.x1 + 0.5;
      const overlapZ = p.z + depth > hole.z0 - 0.5 && p.z - depth < hole.z1 + 0.5;
      assert.ok(!overlapX || !overlapZ, `${id}/${p.id}: klaring til ${h.kind} ved ${h.x}`);
      // Ingen nye bannere henger over kløften, selv om selve stanga kunne stå på baksiden.
      if (h.kind === 'chasm') assert.ok(!overlapX, `${id}/${p.id}: hele banneret utenfor juvets bredde`);
    }

    if (p.parent) {
      const parent = layout.props.find((q) => q.id === p.parent);
      const part = manifest.props[parent.prop].preset.find((q) => q.prop === p.prop);
      assert.ok(part, `${id}/${p.id}: del av det eksisterende settet`);
      const scale = parent.scale ?? 1;
      const near = (a, b) => Math.abs(a - b) < 0.001;
      assert.ok(near(p.x, parent.x + part.dx * scale * (parent.flip ? -1 : 1)), `${id}/${p.id}: vannrett feste`);
      assert.ok(near(p.y ?? 0, (parent.y ?? 0) + part.dy * scale), `${id}/${p.id}: høyde på feste`);
      assert.ok(near(p.z, parent.z + (part.dz ?? 0) * scale), `${id}/${p.id}: bak stanga`);
      assert.ok(near(p.scale ?? 1, (part.scale ?? 1) * scale), `${id}/${p.id}: skala fra settet`);
      assert.equal(!!p.flip, !!parent.flip !== !!part.flip, `${id}/${p.id}: settets speilvending`);
      assert.ok(meta.anim?.some((a) => a.type === 'wave') && p.anim === undefined, `${id}/${p.id}: beholder dukens vindbevegelse`);
    }
  }
  console.log(`OK ${id}: ${ids.length} kulissedeler, bilder, sett og klaring`);
}
assert.deepEqual([...reused].sort(), ['env_altar', 'env_banner_cloth', 'env_banner_pole', 'env_boulder', 'env_fallen_log', 'env_palisade_gate']);
console.log('OK alle fire tidligere ubrukte bilder og frostbanneret er tatt i bruk');
