// Sol med skygger som følger kameraet langs brettet.
// Ett skyggekart holder fordi det synlige området er avgrenset (et vindu som glir langs x).
// Sentrum låses til skyggekartets tekselrutenett, ellers flimrer skyggekantene når kameraet flytter seg
// (threejs-shadow-systems i prosjektbiblioteket).
import * as THREE from 'three';
import { tierOf, gfxState } from '../post';

const UP = new THREE.Vector3(0, 1, 0);

export class SunShadow {
  readonly dir: THREE.Vector3;
  private xAxis = new THREE.Vector3();
  private yAxis = new THREE.Vector3();
  private texelX = 0.02;
  private texelY = 0.02;
  private tmp = new THREE.Vector3();
  readonly on: boolean;

  /**
   * @param light retningslyset (legges i gruppa sammen med målet sitt)
   * @param dir retning mot sola (trenger ikke være normalisert)
   * @param halfW halve bredden på skyggeboksen i verdensenheter
   * @param halfH halve høyden på skyggeboksen
   */
  constructor(group: THREE.Group, readonly light: THREE.DirectionalLight, dir: THREE.Vector3, halfW = 24, halfH = 16) {
    this.dir = dir.clone().normalize();
    this.xAxis.crossVectors(UP, this.dir).normalize();
    this.yAxis.crossVectors(this.dir, this.xAxis).normalize();
    const size = tierOf(gfxState.quality).shadows;
    this.on = size > 0;
    group.add(light, light.target);
    if (!this.on) return;
    light.castShadow = true;
    light.shadow.mapSize.set(size, size);
    const cam = light.shadow.camera;
    cam.left = -halfW;
    cam.right = halfW;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.near = 1;
    cam.far = 140;
    cam.updateProjectionMatrix();
    this.texelX = (2 * halfW) / size;
    this.texelY = (2 * halfH) / size;
    // Mykhet (Vogel-disk i PCF) og skjevhet skalert med tekselstørrelsen
    light.shadow.radius = size >= 4096 ? 4 : size >= 2048 ? 3 : 2;
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = Math.max(this.texelX, this.texelY) * 1.2;
  }

  /** Flytt skyggeboksen til et punkt på bakken, låst til tekselrutenettet. */
  update(x: number, z = -2) {
    const t = this.tmp.set(x, 0, z);
    const lx = Math.round(t.dot(this.xAxis) / this.texelX) * this.texelX;
    const ly = Math.round(t.dot(this.yAxis) / this.texelY) * this.texelY;
    const lz = t.dot(this.dir);
    t.copy(this.xAxis).multiplyScalar(lx).addScaledVector(this.yAxis, ly).addScaledVector(this.dir, lz);
    this.light.target.position.copy(t);
    this.light.position.copy(t).addScaledVector(this.dir, 60);
    this.light.target.updateMatrixWorld();
  }
}
