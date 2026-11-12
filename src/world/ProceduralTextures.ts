import * as THREE from 'three';

export class ProceduralTextures {
  public static createHullWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2d3944';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#151c22';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.strokeRect(4, 132, 120, 120);
    ctx.strokeRect(132, 132, 120, 120);

    ctx.fillStyle = '#40505e';
    for (let x = 14; x < 248; x += 28) {
      ctx.fillRect(x, 12, 4, 4);
      ctx.fillRect(x, 114, 4, 4);
    }

    // Subtle upper light trim line
    ctx.fillStyle = '#536878';
    ctx.fillRect(0, 24, 256, 3);

    // Hazard stripe band along bottom
    ctx.fillStyle = '#b5721f';
    ctx.fillRect(0, 224, 256, 18);
    ctx.fillStyle = '#181e24';
    for (let x = -32; x < 280; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 224);
      ctx.lineTo(x + 12, 224);
      ctx.lineTo(x + 24, 242);
      ctx.lineTo(x + 12, 242);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  public static createFloorGratingTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1f272e';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#364450';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    ctx.fillStyle = '#0e1317';
    for (let y = 8; y < 256; y += 16) {
      for (let x = 8; x < 256; x += 16) {
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  public static createDoorTexture(label: string, color = '#d4842a'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2a343d';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#10151a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 240);

    ctx.fillStyle = '#1d252c';
    ctx.fillRect(24, 24, 208, 88);
    ctx.fillRect(24, 144, 208, 88);

    ctx.fillStyle = color;
    ctx.fillRect(16, 116, 224, 24);

    ctx.fillStyle = '#090c0e';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(label, 128, 133);

    return new THREE.CanvasTexture(canvas);
  }

  public static createCRTScreenTexture(title: string, lines: string[], tint = '#4af2a1'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#04120c';
    ctx.fillRect(0, 0, 256, 192);

    ctx.strokeStyle = tint;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 244, 180);

    ctx.fillStyle = tint;
    ctx.font = 'bold 14px Courier New';
    ctx.fillText(title, 16, 28);

    ctx.fillRect(14, 34, 228, 2);

    ctx.font = '12px Courier New';
    lines.forEach((line, idx) => {
      ctx.fillText(line, 16, 56 + idx * 20);
    });

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < 192; y += 4) {
      ctx.fillRect(0, y, 256, 2);
    }

    return new THREE.CanvasTexture(canvas);
  }

  public static createSignageTexture(sectorTitle: string, subText: string, accent = '#f3a847'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0d151c';
    ctx.fillRect(0, 0, 256, 96);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 88);

    ctx.fillStyle = accent;
    ctx.font = 'bold 18px Courier New';
    ctx.fillText(sectorTitle, 14, 38);

    ctx.fillStyle = '#c4d8e2';
    ctx.font = '13px Courier New';
    ctx.fillText(subText, 14, 68);

    return new THREE.CanvasTexture(canvas);
  }
}
