import React, { useEffect, useRef, useState } from 'react';

interface SpineSegment {
  x: number;
  y: number;
}

interface TraceNode {
  id: string;
  label: string;
  rx: number;
  ry: number;
}

const TRACE_NODES: TraceNode[] = [
  { id: 'internals', label: 'Internals', rx: 0.18, ry: 0.28 },
  { id: 'fastapi', label: 'FastAPI', rx: 0.48, ry: 0.2 },
  { id: 'rag', label: 'RAG & Eval', rx: 0.8, ry: 0.3 },
  { id: 'sql', label: 'SQL', rx: 0.3, ry: 0.75 },
  { id: 'dsa', label: 'DSA', rx: 0.7, ry: 0.74 },
];

const SEGMENT_COUNT = 48;
const SEGMENT_LENGTH = 6.8;

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function getSegmentRadius(index: number, total: number): number {
  const t = total > 1 ? index / (total - 1) : 0;
  if (t < 0.08) {
    // Sleek neck behind the angular head
    return 4.6 + (t / 0.08) * 1.4;
  }
  if (t < 0.46) {
    // Lean, muscular mid-body swell
    const mid = (t - 0.08) / 0.38;
    return 6.0 + Math.sin(mid * Math.PI) * 2.1;
  }
  // Long, continuous taper down to a sharp tail tip
  const tail = (t - 0.46) / 0.54;
  return Math.max(0, 6.0 * Math.pow(Math.max(0, 1 - tail), 1.85));
}

function buildInitialSpine(width: number, height: number): SpineSegment[] {
  const startX = width * 0.54;
  const startY = height * 0.52;
  const segments: SpineSegment[] = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    segments.push({
      x: startX - i * SEGMENT_LENGTH * 0.92,
      y: startY + Math.sin(i * 0.28) * 16,
    });
  }
  return segments;
}

export const InteractivePythonHero: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const hoveredNodeIdRef = useRef<string | null>(null);
  hoveredNodeIdRef.current = hoveredNodeId;

  const stateRef = useRef<{
    width: number;
    height: number;
    segments: SpineSegment[];
    headAngle: number;
    speed: number;
    pointer: { x: number; y: number; inside: boolean };
    clickTarget: { x: number; y: number; ttl: number } | null;
    tongueProgress: number;
    tongueTimer: number;
    time: number;
  }>({
    width: 600,
    height: 300,
    segments: buildInitialSpine(600, 300),
    headAngle: 0.15,
    speed: 1.5,
    pointer: { x: 320, y: 150, inside: false },
    clickTarget: null,
    tongueProgress: 0,
    tongueTimer: 1.4,
    time: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(300, Math.floor(rect.width));
      const height = Math.max(240, Math.floor(rect.height));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const prevW = stateRef.current.width;
      const prevH = stateRef.current.height;
      stateRef.current.width = width;
      stateRef.current.height = height;

      if (
        prevW > 0 &&
        prevH > 0 &&
        (Math.abs(prevW - width) > 20 || Math.abs(prevH - height) > 20)
      ) {
        const sx = width / prevW;
        const sy = height / prevH;
        stateRef.current.segments = stateRef.current.segments.map((seg) => ({
          x: seg.x * sx,
          y: seg.y * sy,
        }));
      }
    };

    resize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(container);

    let rafId = 0;
    let lastTs = performance.now();

    const stepAndDraw = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const s = stateRef.current;
      const { width, height } = s;

      s.time += dt;

      // Tongue flick cadence
      s.tongueTimer -= dt;
      if (s.tongueTimer <= 0) {
        s.tongueProgress += dt * 4.8;
        if (s.tongueProgress >= Math.PI) {
          s.tongueProgress = 0;
          s.tongueTimer = 2.6 + Math.random() * 2.2;
        }
      }

      // Steering target: hovered point trace -> click target -> cursor -> free patrol
      let targetX: number;
      let targetY: number;
      let chasingTarget = false;

      const hoveredNode = hoveredNodeIdRef.current
        ? TRACE_NODES.find((n) => n.id === hoveredNodeIdRef.current) ?? null
        : null;

      if (hoveredNode) {
        targetX = hoveredNode.rx * width;
        targetY = hoveredNode.ry * height;
        chasingTarget = true;
      } else if (s.clickTarget && s.clickTarget.ttl > 0) {
        targetX = s.clickTarget.x;
        targetY = s.clickTarget.y;
        s.clickTarget.ttl -= dt;
        chasingTarget = true;
      } else if (s.pointer.inside) {
        targetX = s.pointer.x;
        targetY = s.pointer.y;
        chasingTarget = true;
      } else {
        targetX =
          width * 0.5 +
          width * 0.28 * Math.sin(s.time * 0.55) +
          width * 0.08 * Math.cos(s.time * 1.1);
        targetY = height * 0.5 + height * 0.25 * Math.sin(s.time * 1.1);
      }

      const head = s.segments[0];
      const dx = targetX - head.x;
      const dy = targetY - head.y;
      const dist = Math.hypot(dx, dy);

      const desiredAngle = Math.atan2(dy, dx);
      const angleDiff = normalizeAngle(desiredAngle - s.headAngle);

      const targetSpeed = chasingTarget
        ? dist < 20
          ? 0.35
          : Math.min(3.4, 1.4 + dist * 0.011)
        : 1.75;

      s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 6);

      const maxTurn = (chasingTarget ? 4.0 : 2.2) * dt;
      const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
      const slitherWave =
        s.speed > 0.5
          ? Math.sin(s.time * (3.6 + s.speed * 0.9)) * 0.028 * s.speed
          : 0;

      s.headAngle = normalizeAngle(s.headAngle + clampedTurn + slitherWave);

      const pad = 26;
      let nextX = head.x + Math.cos(s.headAngle) * s.speed * 60 * dt;
      let nextY = head.y + Math.sin(s.headAngle) * s.speed * 60 * dt;

      if (nextX < pad) {
        nextX = pad;
        s.headAngle = normalizeAngle(Math.PI - s.headAngle);
      } else if (nextX > width - pad) {
        nextX = width - pad;
        s.headAngle = normalizeAngle(Math.PI - s.headAngle);
      }
      if (nextY < pad) {
        nextY = pad;
        s.headAngle = normalizeAngle(-s.headAngle);
      } else if (nextY > height - pad) {
        nextY = height - pad;
        s.headAngle = normalizeAngle(-s.headAngle);
      }

      head.x = nextX;
      head.y = nextY;

      for (let i = 1; i < s.segments.length; i++) {
        const prev = s.segments[i - 1];
        const curr = s.segments[i];

        let vx = curr.x - prev.x;
        let vy = curr.y - prev.y;
        let len = Math.hypot(vx, vy) || 0.001;

        if (s.speed > 0.45 && i < s.segments.length - 4) {
          const perpX = -vy / len;
          const perpY = vx / len;
          const waveAmp =
            Math.sin(s.time * 5.2 - i * 0.42) * 0.24 * Math.min(1.6, s.speed);
          vx += perpX * waveAmp;
          vy += perpY * waveAmp;
          len = Math.hypot(vx, vy) || 0.001;
        }

        curr.x = prev.x + (vx / len) * SEGMENT_LENGTH;
        curr.y = prev.y + (vy / len) * SEGMENT_LENGTH;
      }

      // Draw frame
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = canvas.width / width;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // Subtle engineering dot grid
        ctx.fillStyle = '#E2E8F0';
        const gridStep = 24;
        for (let gx = 16; gx < width; gx += gridStep) {
          for (let gy = 16; gy < height; gy += gridStep) {
            ctx.fillRect(gx, gy, 1.25, 1.25);
          }
        }

        // Coordinate trace points
        for (const node of TRACE_NODES) {
          const nx = node.rx * width;
          const ny = node.ry * height;
          const isHovered = hoveredNodeIdRef.current === node.id;
          const headDist = Math.hypot(head.x - nx, head.y - ny);
          const nearHead = headDist < 54;

          ctx.save();
          if (isHovered || nearHead) {
            ctx.beginPath();
            ctx.arc(nx, ny, isHovered ? 13 : 10, 0, Math.PI * 2);
            ctx.strokeStyle = isHovered
              ? 'rgba(29, 78, 216, 0.5)'
              : 'rgba(15, 23, 42, 0.2)';
            ctx.lineWidth = 1.25;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(nx, ny, 4, 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? '#1D4ED8' : '#64748B';
          ctx.fill();

          ctx.font = '500 11px "JetBrains Mono", monospace';
          ctx.fillStyle = isHovered ? '#1E3A8A' : '#475569';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, nx, ny - 13);
          ctx.restore();
        }

        const leftPts: SpineSegment[] = [];
        const rightPts: SpineSegment[] = [];

        for (let i = 0; i < s.segments.length - 1; i++) {
          const curr = s.segments[i];
          const prev = s.segments[Math.max(0, i - 1)];
          const next = s.segments[Math.min(s.segments.length - 1, i + 1)];
          const tx = next.x - prev.x;
          const ty = next.y - prev.y;
          const tLen = Math.hypot(tx, ty) || 1;
          const nx = -ty / tLen;
          const ny = tx / tLen;
          const radius = getSegmentRadius(i, s.segments.length);

          leftPts.push({ x: curr.x + nx * radius, y: curr.y + ny * radius });
          rightPts.push({ x: curr.x - nx * radius, y: curr.y - ny * radius });
        }

        // Extend final vertex slightly along tail direction for a crisp pointed tip
        const tailEnd = s.segments[s.segments.length - 1];
        const tailPrev = s.segments[s.segments.length - 2];
        const tailDx = tailEnd.x - tailPrev.x;
        const tailDy = tailEnd.y - tailPrev.y;
        const tailLen = Math.hypot(tailDx, tailDy) || 1;
        const tailTip: SpineSegment = {
          x: tailEnd.x + (tailDx / tailLen) * 5,
          y: tailEnd.y + (tailDy / tailLen) * 5,
        };

        const traceBodyPath = () => {
          if (leftPts.length < 2 || rightPts.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(leftPts[0].x, leftPts[0].y);
          for (let i = 1; i < leftPts.length - 1; i++) {
            const xc = (leftPts[i].x + leftPts[i + 1].x) * 0.5;
            const yc = (leftPts[i].y + leftPts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, xc, yc);
          }
          ctx.lineTo(tailTip.x, tailTip.y);
          for (let i = rightPts.length - 1; i > 0; i--) {
            const xc = (rightPts[i].x + rightPts[i - 1].x) * 0.5;
            const yc = (rightPts[i].y + rightPts[i - 1].y) * 0.5;
            ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, xc, yc);
          }
          ctx.lineTo(rightPts[0].x, rightPts[0].y);
          ctx.closePath();
        };

        // Soft ground shadow
        ctx.save();
        ctx.translate(3, 5);
        traceBodyPath();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
        ctx.fill();
        ctx.restore();

        // Main python body silhouette
        traceBodyPath();
        ctx.fillStyle = '#1E293B';
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 0.95;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Dorsal saddle markings & scale highlights
        for (let i = 2; i < s.segments.length - 6; i++) {
          const curr = s.segments[i];
          const prev = s.segments[i - 1];
          const angle = Math.atan2(prev.y - curr.y, prev.x - curr.x);
          const r = getSegmentRadius(i, s.segments.length);

          if (i % 3 === 0 && r > 1.8) {
            ctx.save();
            ctx.translate(curr.x, curr.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, SEGMENT_LENGTH * 0.8, r * 0.68, 0, 0, Math.PI * 2);
            ctx.fillStyle = i % 6 === 0 ? '#1D4ED8' : '#334155';
            ctx.globalAlpha = i % 6 === 0 ? 0.55 : 0.75;
            ctx.fill();
            ctx.restore();
          }

          if (r > 1.4) {
            ctx.save();
            ctx.translate(curr.x, curr.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-1.8, -r * 0.42);
            ctx.lineTo(2.0, 0);
            ctx.lineTo(-1.8, r * 0.42);
            ctx.strokeStyle = 'rgba(248, 250, 252, 0.16)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        }

        // Forked tongue animation
        const tongueFactor = Math.sin(s.tongueProgress);
        if (tongueFactor > 0.05) {
          ctx.save();
          ctx.translate(head.x, head.y);
          ctx.rotate(s.headAngle);
          const ext = 11 + tongueFactor * 12;
          const flick = Math.sin(s.time * 28) * 1.4;
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(ext, flick);
          ctx.lineTo(ext + 4.5, flick - 3);
          ctx.moveTo(ext, flick);
          ctx.lineTo(ext + 4.5, flick + 3);
          ctx.strokeStyle = '#B91C1C';
          ctx.lineWidth = 1.25;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        }

        // Sculpted Python Head
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(s.headAngle);

        ctx.save();
        ctx.translate(2, 3);
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.quadraticCurveTo(9, 7.5, -5, 9.2);
        ctx.quadraticCurveTo(-11, 5.5, -10, 0);
        ctx.quadraticCurveTo(-11, -5.5, -5, -9.2);
        ctx.quadraticCurveTo(9, -7.5, 13, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.quadraticCurveTo(9, 7.2, -5, 9);
        ctx.quadraticCurveTo(-11, 5.5, -9.5, 0);
        ctx.quadraticCurveTo(-11, -5.5, -5, -9);
        ctx.quadraticCurveTo(9, -7.2, 13, 0);
        ctx.closePath();
        ctx.fillStyle = '#0F172A';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(-1.5, 0, 5.5, 3.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
        ctx.fill();

        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(2.5, side * 4.8, 2.3, 1.6, side * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#CBD5E1';
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(2.8, side * 4.8, 0.55, 1.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#020617';
          ctx.fill();
        }

        ctx.restore();
        ctx.restore();
      }

      rafId = window.requestAnimationFrame(stepAndDraw);
    };

    rafId = window.requestAnimationFrame(stepAndDraw);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, []);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const findNearestNode = (
    x: number,
    y: number,
    width: number,
    height: number
  ): TraceNode | null => {
    for (const node of TRACE_NODES) {
      const nx = node.rx * width;
      const ny = node.ry * height;
      if (Math.hypot(x - nx, y - ny) <= 28) {
        return node;
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    stateRef.current.pointer = { x: pt.x, y: pt.y, inside: true };
    const hit = findNearestNode(pt.x, pt.y, pt.width, pt.height);
    setHoveredNodeId(hit ? hit.id : null);
  };

  const handleMouseLeave = () => {
    stateRef.current.pointer.inside = false;
    setHoveredNodeId(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;

    stateRef.current.clickTarget = { x: pt.x, y: pt.y, ttl: 2.0 };
    stateRef.current.tongueTimer = 0;
    if (stateRef.current.tongueProgress === 0) {
      stateRef.current.tongueProgress = 0.08;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full h-[270px] sm:h-[300px] bg-slate-50/70"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          aria-label="Interactive Python specimen tracking cursor and trace points"
          className={`block w-full h-full ${
            hoveredNodeId ? 'cursor-pointer' : 'cursor-crosshair'
          }`}
        />
      </div>
    </div>
  );
};
