// ── Swimlane management ───────────────────────────────────────────────────────
// Adds a new lane band to the live diagram by injecting into the current BPMN
// XML and re-importing. This sidesteps bpmn-js's rule that lanes must live
// inside a Pool/Participant — our process-level lanes work fine with importXML,
// we just can't create them via modeling.createShape on the root element.
//
// After the lane is created:
//   • Drag any node onto the lane band → bpmn-js LaneUpdater auto-updates flowNodeRef
//   • Double-click the lane label → bpmn-js built-in rename
//   • Export YAML → lane: written on each node, lanes: block written at top

const LANE_H       = 160
const LANE_LABEL_W = 30

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Returns a unique-enough lane element ID from a display name
function _laneId(name) {
  const slug = name.replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '')
  return `Lane_${slug || 'New'}_${Date.now().toString(36)}`
}

// Inject a new lane into raw BPMN XML (string manipulation — avoids
// namespace prefix issues from DOMParser → XMLSerializer round-trips).
function _insertLaneInXml(xml, laneName, laneId, nextY, totalW) {
  // 1. Add <bpmn:lane> to the laneSet (create laneSet if absent)
  const laneElem = `\n    <bpmn:lane id="${laneId}" name="${_esc(laneName)}"/>`

  if (xml.includes('<bpmn:laneSet')) {
    // Append before the closing tag of the existing laneSet
    xml = xml.replace(/(<\/bpmn:laneSet>)/, `${laneElem}\n    $1`)
  } else {
    // No laneSet yet — create one right after the opening <bpmn:process ...> tag
    const laneSet = `\n    <bpmn:laneSet id="LaneSet_1">${laneElem}\n    </bpmn:laneSet>`
    xml = xml.replace(/(<bpmn:process[^>]*>)/, `$1${laneSet}`)
  }

  // 2. Add <bpmndi:BPMNShape> for the lane before </bpmndi:BPMNPlane>
  const diShape = `
    <bpmndi:BPMNShape id="${laneId}_di" bpmnElement="${laneId}" isHorizontal="true">
      <dc:Bounds x="${LANE_LABEL_W}" y="${nextY}" width="${totalW}" height="${LANE_H}"/>
      <bpmndi:BPMNLabel/>
    </bpmndi:BPMNShape>`
  xml = xml.replace(/(<\/bpmndi:BPMNPlane>)/, `${diShape}\n    $1`)

  return xml
}

export async function addLaneToModeler(modeler, laneName) {
  if (!laneName || !laneName.trim()) return
  laneName = laneName.trim()

  const elementRegistry = modeler.get('elementRegistry')
  const canvas          = modeler.get('canvas')

  // ── Find existing lane positions to stack the new one below ───────────────
  const existingLanes = elementRegistry.filter(
    el => el.businessObject?.$type === 'bpmn:Lane'
  )

  let nextY  = 0
  let totalW = 900

  if (existingLanes.length > 0) {
    for (const lane of existingLanes) {
      nextY  = Math.max(nextY,  (lane.y  ?? 0) + (lane.height ?? LANE_H))
      totalW = Math.max(totalW, lane.width ?? totalW)
    }
  } else {
    // First lane — use the canvas bounding box of all existing node shapes
    const vbox = canvas.viewbox()
    totalW = Math.max(900, Math.round(vbox.width))
    // Place the lane at Y=0; existing nodes will sit above it until dragged in
  }

  const laneId = _laneId(laneName)

  // ── Mutate the current BPMN XML and re-import ─────────────────────────────
  const { xml } = await modeler.saveXML({ format: true })
  const newXml  = _insertLaneInXml(xml, laneName, laneId, nextY, totalW)

  await modeler.importXML(newXml)

  // Restore fit after re-import; lane bands expand the diagram height
  try { canvas.zoom('fit-viewport', 'auto') } catch (_) {}
}
