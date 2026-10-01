// Flate bakgrunnsfigurer: Vorthax på tronen, prinsessen og publikum.
import * as THREE from 'three';
import { plainCanvas, unitCanvas, INK } from '../draw';
import { pick } from '../../core/math';
import { canvasTex, spriteMesh } from './common';

export function vorthaxSprite() {
  const cv = unitCanvas(2.4, 3.2, 1.2, 0.1, 110, (p) => {
    // Trone
    p.poly([-0.9, 0, 0.9, 0, 0.9, 1.1, 0.7, 2.6, 0.4, 2.2, 0, 2.9, -0.4, 2.2, -0.7, 2.6, -0.9, 1.1], '#2a1f33');
    p.poly([-0.7, 1.0, 0.7, 1.0, 0.7, 1.2, -0.7, 1.2], '#4a3a5a');
    for (const x of [-0.7, 0, 0.7]) p.ell(x, x === 0 ? 2.75 : 2.5, 0.12, 0.12, '#efe8d2');
    // Kappe
    p.blob([-0.5, 0.2, 0.5, 0.2, 0.55, 1.0, 0.4, 1.7, 0, 1.85, -0.4, 1.7, -0.55, 1.0], '#5b2a86');
    p.poly([-0.1, 1.8, 0.1, 1.8, 0.2, 0.3, -0.2, 0.3], '#7a3fb0');
    // Hode + hatt
    p.ell(0, 2.0, 0.24, 0.24, '#d8c2a8');
    p.poly([-0.36, 2.12, 0.36, 2.12, 0.1, 3.05, -0.05, 2.9], '#5b2a86');
    p.ell(0.02, 2.5, 0.08, 0.08, '#efe8d2');
    p.blob([-0.2, 1.96, 0.2, 1.96, 0.16, 1.5, 0, 1.3, -0.16, 1.5], '#d9d9d9');
    p.line([-0.12, 2.06, -0.03, 2.03], 0.04);
    p.line([0.12, 2.06, 0.03, 2.03], 0.04);
    p.ell(-0.08, 2.0, 0.03, 0.02, '#ff3b2f', false);
    p.ell(0.08, 2.0, 0.03, 0.02, '#ff3b2f', false);
    // Stav
    p.line([0.7, 0.2, 0.62, 2.4], 0.06, '#5a3a20');
    p.ell(0.62, 2.5, 0.14, 0.14, '#44e0ff');
    p.ell(0.35, 1.3, 0.12, 0.1, '#d8c2a8');
  });
  return spriteMesh(cv, 2.4, 3.2);
}

/** Prinsessen med et skilt (BORED, eller FINALLY når hun slipper ut av buret i tårnet). */
export function princessSprite(sign = 'BORED') {
  const cv = unitCanvas(1.8, 3.0, 0.9, 0.05, 110, (p) => {
    p.poly([-0.5, 0, 0.5, 0, 0.3, 1.2, -0.3, 1.2], '#e76fa8');
    p.poly([-0.22, 1.2, 0.22, 1.2, 0.18, 1.6, -0.18, 1.6], '#f59ac4');
    p.ell(0, 1.84, 0.22, 0.24, '#f3cfb0');
    p.blob([-0.26, 1.9, -0.3, 1.4, -0.2, 1.3, -0.14, 1.7], '#f2d04b');
    p.blob([0.26, 1.9, 0.3, 1.4, 0.2, 1.3, 0.14, 1.7], '#f2d04b');
    p.poly([-0.2, 2.02, 0.2, 2.02, 0.05, 2.9, -0.05, 2.9], '#e76fa8');
    p.line([0.03, 2.88, 0.5, 2.2], 0.03, '#ffffff');
    // Uinteressert fjes
    p.line([-0.12, 1.86, -0.04, 1.86], 0.03);
    p.line([0.04, 1.86, 0.12, 1.86], 0.03);
    p.line([-0.06, 1.72, 0.06, 1.72], 0.025);
    // Skilt
    p.line([0.5, 0.6, 0.5, 1.5], 0.05, '#6b4a2b');
    p.rrect(0.1, 1.3, 0.8, 0.46, 0.04, '#f1e3c0');
    p.ell(0.4, 1.0, 0.09, 0.08, '#f3cfb0');
  });
  // Tekst (vanlig retning)
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#7a1010';
  c.font = 'bold 26px Impact, sans-serif';
  c.textAlign = 'center';
  c.font = `bold ${sign.length > 5 ? 20 : 26}px Impact, sans-serif`;
  c.fillText(sign, (0.9 + 0.5) * 110, cv.height - (0.05 + 1.46) * 110);
  return spriteMesh(cv, 1.8, 3.0);
}

export function crowdTex(seed: number) {
  return canvasTex(plainCanvas(1024, 128, (c) => {
    c.clearRect(0, 0, 1024, 128);
    const skins = ['#e2a26b', '#f2c59c', '#c98a5a', '#7d9b45', '#efe8d2', '#a7744a'];
    const cloth = ['#5b2a86', '#8e2a2a', '#2e5f9e', '#5a6b3a', '#6b4a2b', '#333'];
    for (let i = 0; i < 26; i++) {
      const x = 20 + i * 39 + Math.sin(i * 7 + seed) * 6;
      const col = pick(cloth);
      c.fillStyle = col;
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(x, 118, 22, 40, 0, Math.PI, 0);
      c.fill();
      c.stroke();
      const sk = pick(skins);
      c.fillStyle = sk;
      c.beginPath();
      c.arc(x, 62, 15, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (Math.random() < 0.4) {
        c.fillStyle = '#888';
        c.beginPath();
        c.moveTo(x - 14, 56);
        c.lineTo(x - 20, 36);
        c.lineTo(x - 6, 50);
        c.moveTo(x + 14, 56);
        c.lineTo(x + 20, 36);
        c.lineTo(x + 6, 50);
        c.fill();
      }
      c.fillStyle = INK;
      c.fillRect(x - 6, 58, 3, 4);
      c.fillRect(x + 3, 58, 3, 4);
      if (Math.random() < 0.3) {
        c.strokeStyle = sk;
        c.lineWidth = 9;
        c.beginPath();
        c.moveTo(x + 18, 96);
        c.lineTo(x + 24, 40);
        c.stroke();
        c.strokeStyle = INK;
        c.lineWidth = 3;
        c.stroke();
      }
    }
  }), );
}

