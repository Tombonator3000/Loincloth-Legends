// Verdenskartet: gå mellom noder (brett, arenaer, hjemborgen) med tastatur eller gamepad.
import * as THREE from 'three';
import type { Scene } from '../scene';
import type { Game } from '../game';
import { W } from '../../game/world';
import { Fighter } from '../../game/fighter';
import { buildWorldMap } from '../../gfx/env/worldmap';
import { buildHeroDef } from '../../gfx/chars/hero';
import { registerChar } from '../../gfx/chars';
import { MAP_NODES, MAP_EDGES, nodeById, type MapNode } from '../../data/worldmap';
import { LEVELS } from '../../data/levels';
import { BOSSES } from '../../data/bosses';
import { DUELISTS } from '../../data/duelists';
import { audio } from '../../core/audio';
import { showTraining } from '../camp';
import { petMesh } from '../../gfx/pets';
import { GRADES } from '../../gfx/env/grades';

export function nodeOpen(completed: Set<string>, n: MapNode) {
  return n.requires.every((r) => completed.has(r));
}

export class MapScene implements Scene {
  name = 'map';
  pausable = true;
  map: ReturnType<typeof buildWorldMap>;
  heroes: Fighter[] = [];
  cur: MapNode;
  walk: { from: THREE.Vector3; to: THREE.Vector3; t: number; len: number; node: MapNode } | null = null;
  panel: HTMLDivElement;
  camPos = new THREE.Vector3();
  grade = GRADES.map;
  pets: { mesh: THREE.Mesh; owner: Fighter; pos: THREE.Vector3; flies: boolean }[] = [];

  constructor(private game: Game, private onEnter: (n: MapNode) => void) {
    const s = game.save;
    this.map = buildWorldMap(W.scene, W.gore);
    this.map.setStates(new Set(s.completed));
    this.cur = nodeById(s.node) ?? MAP_NODES[0];
    const n = game.twoP ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const id = registerChar(buildHeroDef(s.heroes[i], i));
      const f = new Fighter(id, 'hero', { hp: 100, speed: 3, scale: 0.62 });
      f.pos.set(this.cur.pos[0] - 0.4 + i * 0.8, 0, this.cur.pos[1] + 0.6);
      f.addTo(W.scene);
      this.heroes.push(f);
      const pet = game.progressOf(i).pet;
      if (pet) {
        const mesh = petMesh(pet);
        mesh.scale.setScalar(0.62);
        W.scene.add(mesh);
        this.pets.push({ mesh, owner: f, pos: f.pos.clone(), flies: pet === 'eyeball' || pet === 'skull' || pet === 'dragon' });
      }
    }
    this.camPos.set(this.cur.pos[0] * 0.8, 21, this.cur.pos[1] * 0.7 + 15);
    game.camera.position.copy(this.camPos);
    game.hud.visible(false);
    game.screens.hide();
    audio.play('title');
    this.panel = document.createElement('div');
    this.panel.className = 'mappanel';
    game.app.appendChild(this.panel);
    this.renderPanel();
  }

  private neighbors() {
    const out: MapNode[] = [];
    for (const [a, b] of MAP_EDGES) {
      if (a === this.cur.id) out.push(nodeById(b)!);
      if (b === this.cur.id) out.push(nodeById(a)!);
    }
    return out;
  }

  /** Tegn panelet på nytt (etter kjøp i butikken osv.). */
  refresh() {
    this.renderPanel();
  }

  private renderPanel() {
    const s = this.game.save;
    const done = new Set(s.completed);
    const n = this.cur;
    let kind = 'HOME';
    let extra = '';
    if (n.kind === 'level' && n.level) {
      const lv = LEVELS[n.level];
      kind = lv.name;
      extra = lv.finale.type === 'boss' ? 'BOSS: ' + (BOSSES[lv.finale.boss]?.name ?? '?') : 'DUEL TO THE DEATH: ' + (DUELISTS[lv.finale.duelist]?.name ?? '?');
    } else if (n.kind === 'arena' && n.duel) {
      kind = 'ARENA';
      const d = DUELISTS[n.duel];
      extra = 'DUEL: ' + (d.char === '@player' ? 'DARK ' + s.heroes[0].name : d.name);
    }
    const status = done.has(n.id) ? '<span class="st done">COMPLETED</span>' : n.kind === 'home' ? '' : '<span class="st new">NEW</span>';
    const reward = n.reward?.unlock?.length && !done.has(n.id) ? `<div class="mp-reward">REWARD: UNLOCKS NEW GEAR IN THE HERO FORGE</div>` : '';
    const count = MAP_NODES.filter((x) => x.kind !== 'home' && done.has(x.id)).length;
    const total = MAP_NODES.filter((x) => x.kind !== 'home').length;
    this.panel.innerHTML = `
      <div class="mp-top"><span>GOLD <b>${s.gold}</b></span><span>CONQUERED <b>${count}/${total}</b></span></div>
      <div class="mp-card">
        <div class="mp-kind">${kind} ${status}</div>
        <div class="mp-name">${n.name}</div>
        ${extra ? `<div class="mp-extra">${extra}</div>` : ''}
        <div class="mp-blurb">${n.blurb}</div>
        ${reward}
        <div class="mp-keys">PILTASTER/WASD: BEVEG &nbsp; F/ENTER: ${n.kind === 'home' ? 'BORGEN' : 'START'} &nbsp; R: TRENING &nbsp; ESC: MENY</div>
      </div>`;
  }

  update(dt: number) {
    const inp = this.game.input;
    const done = new Set(this.game.save.completed);
    this.map.update(dt, W.time);

    if (this.walk) {
      const w = this.walk;
      w.t += (dt * 5.5) / Math.max(0.1, w.len);
      const k = Math.min(1, w.t);
      this.heroes.forEach((f, i) => {
        const lag = Math.max(0, k - i * 0.12);
        const p = w.from.clone().lerp(w.to, lag);
        f.pos.set(p.x - 0.4 + i * 0.8, 0, p.z + 0.6);
        f.face(w.to.x - w.from.x || 1);
        f.state = 'walk';
        f.running = false;
        f.walkPh += dt * 10;
        f.animate(dt);
      });
      if (k >= 1) {
        this.cur = w.node;
        this.walk = null;
        this.game.save.node = this.cur.id;
        for (const f of this.heroes) f.setState('idle');
        this.renderPanel();
        audio.menu();
      }
    } else {
      for (const f of this.heroes) f.animate(dt);
      const p = inp.players[0];
      const ax = (inp.menu.right ? 1 : 0) - (inp.menu.left ? 1 : 0) || p.axisX();
      const az = (inp.menu.down ? 1 : 0) - (inp.menu.up ? 1 : 0) || p.axisY();
      if (ax || az) {
        let best: MapNode | null = null;
        let bs = 0.35;
        for (const nb of this.neighbors()) {
          if (!nodeOpen(done, nb)) continue;
          const dx = nb.pos[0] - this.cur.pos[0], dz = nb.pos[1] - this.cur.pos[1];
          const l = Math.hypot(dx, dz);
          const sc = (dx * ax + dz * az) / (l * Math.hypot(ax, az));
          if (sc > bs) {
            bs = sc;
            best = nb;
          }
        }
        if (best) {
          const from = new THREE.Vector3(this.cur.pos[0], 0, this.cur.pos[1]);
          const to = new THREE.Vector3(best.pos[0], 0, best.pos[1]);
          this.walk = { from, to, t: 0, len: from.distanceTo(to), node: best };
        }
      }
      if (inp.menu.confirm || p.pressed.attack || p.pressed.jump) {
        audio.confirm();
        this.onEnter(this.cur);
        return;
      }
      if (p.pressed.grab) {
        audio.confirm();
        showTraining(this.game, 0, () => this.game.backToMap());
        return;
      }
      if (p.pressed.special) {
        this.game.togglePause();
        return;
      }
    }

    for (const p of this.pets) {
      const o = p.owner;
      const target = new THREE.Vector3(o.pos.x - o.facing * 0.7, p.flies ? 1.5 + Math.sin(W.time * 3) * 0.1 : 0.18, o.pos.z - 0.3);
      p.pos.lerp(target, Math.min(1, dt * 4));
      p.mesh.position.copy(p.pos);
      p.mesh.scale.x = 0.62 * (target.x > p.pos.x + 0.05 ? 1 : target.x < p.pos.x - 0.05 ? -1 : o.facing);
    }
    const lead = this.heroes[0].pos;
    const target = new THREE.Vector3(lead.x * 0.8, 21, lead.z * 0.7 + 15);
    this.camPos.lerp(target, Math.min(1, dt * 3));
    const cam = this.game.camera;
    cam.position.copy(this.camPos);
    cam.lookAt(this.camPos.x, 0, this.camPos.z - 15);
    // Fokus på bakken der kameraet ser (kartet ligger flatt, ikke i planet z = 0)
    if (W.post) W.post.focus = Math.hypot(21, 15);
  }

  exit() {
    this.panel.remove();
    for (const f of this.heroes) f.remove();
    for (const p of this.pets) p.mesh.removeFromParent();
  }
}
