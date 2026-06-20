import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { append as svgAppend, create as svgCreate, attr as svgAttr } from 'tiny-svg'
import { getTypeInfo } from './types.js'

const HIGH_PRIORITY = 1500

export default class APMNRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer', 'styles']

  constructor(eventBus, bpmnRenderer, styles) {
    super(eventBus, HIGH_PRIORITY)
    this.bpmnRenderer = bpmnRenderer
    this.styles = styles
  }

  canRender(element) {
    return !!(element.businessObject?.$attrs?.['apmn:type'])
  }

  drawShape(parentNode, element) {
    const apmnType = element.businessObject.$attrs['apmn:type']
    const info = getTypeInfo(apmnType)
    const { width, height } = element

    if (!info) return this.bpmnRenderer.drawShape(parentNode, element)

    const isGate = info.bpmnType === 'bpmn:ExclusiveGateway'

    if (isGate) {
      return this._drawGate(parentNode, element, info)
    }
    return this._drawTask(parentNode, element, info)
  }

  _drawTask(parentNode, element, info) {
    const { width, height } = element

    // Rounded rect background
    const rect = svgCreate('rect')
    svgAttr(rect, {
      x: 0, y: 0,
      width, height,
      rx: 8, ry: 8,
      fill: info.color,
      stroke: this._darken(info.color),
      strokeWidth: 2,
    })
    svgAppend(parentNode, rect)

    // Top colour strip
    const strip = svgCreate('rect')
    svgAttr(strip, {
      x: 0, y: 0,
      width, height: 6,
      rx: 8, ry: 8,
      fill: this._darken(info.color),
    })
    svgAppend(parentNode, strip)

    // Fix strip corners at bottom
    const stripFix = svgCreate('rect')
    svgAttr(stripFix, { x: 0, y: 3, width, height: 4, fill: this._darken(info.color) })
    svgAppend(parentNode, stripFix)

    // Icon
    const icon = svgCreate('text')
    svgAttr(icon, {
      x: width / 2, y: height / 2 - 6,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 20,
      fontFamily: 'system-ui, sans-serif',
    })
    icon.textContent = info.icon
    svgAppend(parentNode, icon)

    // Label
    const label = svgCreate('text')
    svgAttr(label, {
      x: width / 2, y: height / 2 + 16,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 10,
      fontWeight: '600',
      fontFamily: 'system-ui, sans-serif',
      letterSpacing: '0.02em',
    })
    label.textContent = info.label.toUpperCase()
    svgAppend(parentNode, label)

    // Element name below label
    const name = element.businessObject.name
    if (name) {
      const nameEl = svgCreate('text')
      svgAttr(nameEl, {
        x: width / 2, y: height - 10,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fill: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
      })
      nameEl.textContent = name.length > 18 ? name.slice(0, 17) + '…' : name
      svgAppend(parentNode, nameEl)
    }

    return rect
  }

  _drawGate(parentNode, element, info) {
    const { width, height } = element
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - 2

    // Diamond shape
    const diamond = svgCreate('polygon')
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
    svgAttr(diamond, {
      points: pts,
      fill: info.color,
      stroke: this._darken(info.color),
      strokeWidth: 2,
    })
    svgAppend(parentNode, diamond)

    // Icon in centre
    const icon = svgCreate('text')
    svgAttr(icon, {
      x: cx, y: cy - 5,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 14,
      fontFamily: 'system-ui, sans-serif',
    })
    icon.textContent = info.icon
    svgAppend(parentNode, icon)

    // Short type label
    const shortLabel = {
      confidenceGate: 'CONF',
      reasoningGate: 'RSNG',
      modelVersionGate: 'MVER',
      semanticGate: 'SEM',
      mcpGate: 'MCP',
      escapeGate: 'ESC',
    }[info.type] || ''

    const label = svgCreate('text')
    svgAttr(label, {
      x: cx, y: cy + 10,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 8,
      fontWeight: '700',
      fontFamily: 'system-ui, sans-serif',
      letterSpacing: '0.04em',
    })
    label.textContent = shortLabel
    svgAppend(parentNode, label)

    return diamond
  }

  getShapePath(shape) {
    return this.bpmnRenderer.getShapePath(shape)
  }

  _darken(hex) {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.max(0, (n >> 16) - 40)
    const g = Math.max(0, ((n >> 8) & 0xff) - 40)
    const b = Math.max(0, (n & 0xff) - 40)
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  }
}
