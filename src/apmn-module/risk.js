// Tracks which node ids are "risk-prone" — referenced by an escapeGate's `watches`
// list, or carrying their own `escalate_to`. Recomputed on import and on every
// model edit; the renderer reads this set to draw the risk bubble. Visualization
// only — no new APMN spec construct, `watches`/`escalate_to` already exist.

export const riskRegistry = new Set()

export function recomputeRisk(elementRegistry) {
  riskRegistry.clear()

  elementRegistry.forEach(element => {
    const bo = element.businessObject
    if (!bo) return

    const watches = bo.$attrs?.['apmn:watches'] ?? bo.watches
    if (watches) {
      String(watches)
        .replace(/[[\]]/g, '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(id => riskRegistry.add(id))
    }

    const escalateTo = bo.$attrs?.['apmn:escalate_to'] ?? bo.escalate_to
    if (escalateTo) riskRegistry.add(bo.id)
  })
}
