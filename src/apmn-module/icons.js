// SVG icon descriptors — 24×24 viewBox, stroke-based
// Format: [tag, attrs]  (fill:none + white stroke applied by renderer group)

export const ICONS = {
  // ── AI Tasks ────────────────────────────────────────────────────────────────

  bot: [
    ['rect',  { x: 3, y: 10, width: 18, height: 11, rx: 2 }],
    ['path',  { d: 'M8 10V7a4 4 0 0 1 8 0v3' }],
    ['circle',{ cx: 9,  cy: 16, r: 1, fill: 'white' }],
    ['circle',{ cx: 15, cy: 16, r: 1, fill: 'white' }],
  ],

  bookOpen: [
    ['path', { d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' }],
    ['path', { d: 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' }],
  ],

  plug: [
    ['line', { x1: 9,  y1: 3, x2: 9,  y2: 8 }],
    ['line', { x1: 15, y1: 3, x2: 15, y2: 8 }],
    ['path', { d: 'M7 8h10l-1 8H8L7 8z' }],
    ['line', { x1: 12, y1: 16, x2: 12, y2: 21 }],
  ],

  userCheck: [
    ['path',    { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle',  { cx: 9, cy: 7, r: 4 }],
    ['polyline',{ points: '16 11 18 13 22 9' }],
  ],

  arrowRight: [
    ['line', { x1: 3, y1: 6,  x2: 3,  y2: 18 }],
    ['path', { d: 'M7 12h14' }],
    ['path', { d: 'M15 6l6 6-6 6' }],
  ],

  // neural-network metaphor for memory
  brain: [
    ['circle',{ cx: 12, cy: 5,  r: 2 }],
    ['circle',{ cx: 5,  cy: 14, r: 2 }],
    ['circle',{ cx: 19, cy: 14, r: 2 }],
    ['circle',{ cx: 12, cy: 20, r: 2 }],
    ['line',  { x1: 12, y1: 7,  x2: 7,  y2: 12 }],
    ['line',  { x1: 12, y1: 7,  x2: 17, y2: 12 }],
    ['line',  { x1: 7,  y1: 16, x2: 10, y2: 18 }],
    ['line',  { x1: 17, y1: 16, x2: 14, y2: 18 }],
    ['line',  { x1: 7,  y1: 14, x2: 17, y2: 14 }],
  ],

  database: [
    ['ellipse',{ cx: 12, cy: 5, rx: 9, ry: 3 }],
    ['path',   { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }],
    ['path',   { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' }],
  ],

  activity: [
    ['polyline',{ points: '22 12 18 12 15 21 9 3 6 12 2 12' }],
  ],

  // ── AI Gates ────────────────────────────────────────────────────────────────

  gauge: [
    ['path',  { d: 'M3 12a9 9 0 1 0 18 0' }],
    ['path',  { d: 'M12 12l3-5' }],
    ['circle',{ cx: 12, cy: 12, r: 1, fill: 'white' }],
  ],

  gitBranch: [
    ['line',  { x1: 6, y1: 3,  x2: 6,  y2: 15 }],
    ['circle',{ cx: 18, cy: 6,  r: 3 }],
    ['circle',{ cx: 6,  cy: 18, r: 3 }],
    ['path',  { d: 'M18 9a9 9 0 0 1-9 9' }],
  ],

  shuffle: [
    ['polyline',{ points: '16 3 21 3 21 8' }],
    ['line',    { x1: 4, y1: 20, x2: 21, y2: 3 }],
    ['polyline',{ points: '21 16 21 21 16 21' }],
    ['line',    { x1: 15, y1: 15, x2: 21, y2: 21 }],
    ['line',    { x1: 4,  y1: 4,  x2: 9,  y2: 9 }],
  ],

  waves: [
    ['path',{ d: 'M2 10 Q5.5 6 9 10 Q12.5 14 16 10 Q19.5 6 22 10' }],
    ['path',{ d: 'M2 15 Q5.5 11 9 15 Q12.5 19 16 15 Q19.5 11 22 15' }],
  ],

  zap: [
    ['polygon',{ points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }],
  ],

  shieldAlert: [
    ['path',  { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
    ['line',  { x1: 12, y1: 8,  x2: 12,   y2: 12 }],
    ['circle',{ cx: 12, cy: 16, r: 1, fill: 'white' }],
  ],

  // ── BPMN Structural ─────────────────────────────────────────────────────────

  settings: [
    ['circle',{ cx: 12, cy: 12, r: 3 }],
    ['line',  { x1: 12,   y1: 2,     x2: 12,   y2: 5 }],
    ['line',  { x1: 12,   y1: 19,    x2: 12,   y2: 22 }],
    ['line',  { x1: 4.22, y1: 4.22,  x2: 6.34, y2: 6.34 }],
    ['line',  { x1: 17.66,y1: 17.66, x2: 19.78,y2: 19.78 }],
    ['line',  { x1: 2,    y1: 12,    x2: 5,    y2: 12 }],
    ['line',  { x1: 19,   y1: 12,    x2: 22,   y2: 12 }],
    ['line',  { x1: 4.22, y1: 19.78, x2: 6.34, y2: 17.66 }],
    ['line',  { x1: 17.66,y1: 6.34,  x2: 19.78,y2: 4.22 }],
  ],

  user: [
    ['path',  { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }],
    ['circle',{ cx: 12, cy: 7, r: 4 }],
  ],

  hand: [
    ['path',{ d: 'M9 3v8M12 2v9M15 3v8' }],
    ['path',{ d: 'M6 10v4a6 6 0 0 0 12 0v-4' }],
  ],

  code: [
    ['polyline',{ points: '16 18 22 12 16 6' }],
    ['polyline',{ points: '8 6 2 12 8 18' }],
  ],

  clipboardCheck: [
    ['path',{ d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2' }],
    ['rect',{ x: 9, y: 3, width: 6, height: 4, rx: 2 }],
    ['path',{ d: 'M9 12l2 2 4-4' }],
  ],

  timer: [
    ['circle',  { cx: 12, cy: 12, r: 9 }],
    ['polyline',{ points: '12 7 12 12 15 15' }],
  ],
}

// Render an icon into an SVG parent node (tiny-svg context)
export function renderIcon(svgCreate, svgAttr, svgAppend, parentNode, iconKey, cx, cy, size = 18) {
  const elements = ICONS[iconKey]
  if (!elements) return
  const scale = size / 24
  const g = svgCreate('g')
  svgAttr(g, {
    transform: `translate(${cx - size / 2},${cy - size / 2}) scale(${scale})`,
    fill: 'none',
    stroke: 'white',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })
  for (const [tag, attrs] of elements) {
    const el = svgCreate(tag)
    svgAttr(el, attrs)
    svgAppend(g, el)
  }
  svgAppend(parentNode, g)
}

// Returns an inline SVG string for use in HTML (sidebar chips etc.)
export function iconToSvg(iconKey, size = 16) {
  const elements = ICONS[iconKey]
  if (!elements) return ''
  const parts = elements.map(([tag, attrs]) => {
    const attStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ')
    return `<${tag} ${attStr}/>`
  }).join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${parts}</svg>`
}
