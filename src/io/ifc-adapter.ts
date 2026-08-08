// IFC import/export via web-ifc — §C, §D.4
// Maps internal model ↔ IFC-SPF entities

export function importIfc(_buffer: ArrayBuffer): unknown {
  throw new Error('Not implemented — see M2')
}

export function exportIfc(_project: unknown): Promise<ArrayBuffer> {
  throw new Error('Not implemented — see M2')
}