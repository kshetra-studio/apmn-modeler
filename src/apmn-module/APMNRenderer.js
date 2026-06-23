import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { append as svgAppend, create as svgCreate, attr as svgAttr } from 'tiny-svg'
import { getTypeInfo } from './types.js'
import { renderIcon, iconToSvg } from './icons.js'
import { riskRegistry } from './risk.js'

const HIGH_PRIORITY = 1500

export default class APMNRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer', 'styles']

  constructor(eventBus, bpmnRenderer, styles) {
    super(eventBus, HIGH_PRIORITY)
    this.bpmnRenderer = bpmnRenderer
    this.styles = styles
  }

  canRender(element) {
    const bo = element.businessObject
    if (!bo) return false
    if (bo.$type?.startsWith('apmn:')) return true
    if (bo.$attrs?.['apmn:type']) return true
    return bo.$type === 'bpmn:StartEvent' || bo.$type === 'bpmn:EndEvent'
  }

  _resolveTypeInfo(element) {
    const bo = element.businessObject
    if (bo.$type?.startsWith('apmn:')) {
      const raw = bo.$type.replace('apmn:', '')
      const key = raw.charAt(0).toLowerCase() + raw.slice(1)
      return getTypeInfo(key)
    }
    const legacyKey = bo.$attrs?.['apmn:type']
    return legacyKey ? getTypeInfo(legacyKey) : null
  }

  drawShape(parentNode, element) {
    const bo = element.businessObject

    if (bo.$type === 'bpmn:StartEvent') {
      return this._drawEvent(parentNode, element, { icon: '●', color: '#16a34a', type: '_startEvent' })
    }
    if (bo.$type === 'bpmn:EndEvent') {
      return this._drawEvent(parentNode, element, { icon: '◉', color: '#dc2626', type: '_endEvent' })
    }

    const info = this._resolveTypeInfo(element)
    if (!info) return this.bpmnRenderer.drawShape(parentNode, element)

    const baseType = bo.$type || ''
    const isGate  = baseType.includes('Gateway')
    const isEvent = baseType.includes('Event')

    const shape = isGate ? this._drawGate(parentNode, element, info)
      : isEvent ? this._drawEvent(parentNode, element, info)
      : this._drawTask(parentNode, element, info)

    if (riskRegistry.has(bo.id)) this._drawRiskBubble(parentNode, element)
    return shape
  }

  // Small amber bubble at the top-right corner — flags a node that's watched
  // by an escapeGate, or that itself escalates. Property-driven, not an arrow.
  _drawRiskBubble(parentNode, element) {
    const { width } = element
    const cx = width - 2
    const cy = 2
    const r = 7

    const circle = svgCreate('circle')
    svgAttr(circle, {
      cx, cy, r,
      fill: '#D97706',
      stroke: '#fff',
      'stroke-width': 1.5,
    })
    svgAppend(parentNode, circle)

    const icon = svgCreate('text')
    svgAttr(icon, {
      x: cx, y: cy + 1,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: 'white', 'font-size': 9, 'font-weight': '700',
      'font-family': 'system-ui, sans-serif',
    })
    icon.textContent = '!'
    svgAppend(parentNode, icon)
  }

  _drawTask(parentNode, element, info) {
    const { width, height } = element

    // Background rect
    const rect = svgCreate('rect')
    svgAttr(rect, {
      x: 0, y: 0, width, height, rx: 8, ry: 8,
      fill: info.color,
      stroke: this._darken(info.color),
      'stroke-width': 1.5,
    })
    svgAppend(parentNode, rect)

    // Top colour strip
    const strip = svgCreate('rect')
    svgAttr(strip, { x: 0, y: 0, width, height: 5, rx: 8, ry: 8, fill: this._darken(info.color) })
    svgAppend(parentNode, strip)
    const stripFix = svgCreate('rect')
    svgAttr(stripFix, { x: 0, y: 3, width, height: 3, fill: this._darken(info.color) })
    svgAppend(parentNode, stripFix)

    // SVG icon centred in upper portion
    const iconCy = height / 2 - 8
    if (info.svgIcon) {
      renderIcon(svgCreate, svgAttr, svgAppend, parentNode, info.svgIcon, width / 2, iconCy, 20)
    } else {
      const icon = svgCreate('text')
      svgAttr(icon, {
        x: width / 2, y: iconCy,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: 'white', 'font-size': 18, 'font-family': 'system-ui, sans-serif',
      })
      icon.textContent = info.icon
      svgAppend(parentNode, icon)
    }

    // Type label (small caps, below icon)
    const label = svgCreate('text')
    svgAttr(label, {
      x: width / 2, y: height - 10,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: 'rgba(255,255,255,0.75)', 'font-size': 9,
      'font-weight': '700', 'font-family': 'system-ui, sans-serif',
      'letter-spacing': '0.06em',
    })
    label.textContent = info.label.toUpperCase()
    svgAppend(parentNode, label)

    // Element name (if set)
    const name = element.businessObject.name
    if (name) {
      const nameEl = svgCreate('text')
      svgAttr(nameEl, {
        x: width / 2, y: height / 2 + 6,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: 'rgba(255,255,255,0.92)', 'font-size': 11,
        'font-family': 'system-ui, sans-serif',
      })
      nameEl.textContent = name.length > 16 ? name.slice(0, 15) + '…' : name
      svgAppend(parentNode, nameEl)
    }

    return rect
  }

  _drawEvent(parentNode, element, info) {
    const { width, height } = element
    const cx = width / 2
    const cy = height / 2
    const r  = Math.max(0, Math.min(width, height) / 2 - 2)
    const isEnd = info.type === '_endEvent'

    const circle = svgCreate('circle')
    svgAttr(circle, {
      cx, cy, r,
      fill: info.color,
      stroke: this._darken(info.color),
      'stroke-width': isEnd ? 4 : 2,
    })
    svgAppend(parentNode, circle)

    if (info.svgIcon) {
      renderIcon(svgCreate, svgAttr, svgAppend, parentNode, info.svgIcon, cx, cy, Math.max(10, r * 0.9))
    } else {
      const icon = svgCreate('text')
      svgAttr(icon, {
        x: cx, y: cy + 1,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: 'white', 'font-size': 14, 'font-family': 'system-ui, sans-serif',
      })
      icon.textContent = info.icon
      svgAppend(parentNode, icon)
    }

    return circle
  }

  _drawGate(parentNode, element, info) {
    const { width, height } = element
    const cx = width / 2
    const cy = height / 2
    const r  = Math.max(0, Math.min(width, height) / 2 - 1)

    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
    const diamond = svgCreate('polygon')
    svgAttr(diamond, {
      points: pts,
      fill: info.color,
      stroke: this._darken(info.color),
      'stroke-width': 2,
    })
    svgAppend(parentNode, diamond)

    const innerR = r * 0.55
    if (info.svgIcon) {
      renderIcon(svgCreate, svgAttr, svgAppend, parentNode, info.svgIcon, cx, cy, innerR * 1.4)
    } else if (info.icon) {
      const fontSize = info.icon.length > 1 ? 11 : 15
      const icon = svgCreate('text')
      svgAttr(icon, {
        x: cx, y: cy + 1,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: 'white', 'font-size': fontSize, 'font-weight': '700',
        'font-family': 'system-ui, "Segoe UI", sans-serif',
      })
      icon.textContent = info.icon
      svgAppend(parentNode, icon)
    }

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
