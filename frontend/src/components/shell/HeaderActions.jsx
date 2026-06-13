import { createContext, useContext, useState } from "react"
import { createPortal } from "react-dom"

const Ctx = createContext({ node: null, setNode: () => {} })

export function HeaderActionsProvider({ children }) {
  const [node, setNode] = useState(null)
  return <Ctx.Provider value={{ node, setNode }}>{children}</Ctx.Provider>
}

// Rendered once inside TopBar — the mount point.
export function HeaderActionsSlot() {
  const { setNode } = useContext(Ctx)
  return <div ref={setNode} className="flex items-center gap-2" />
}

// Used by views: <HeaderActions><button …/></HeaderActions>
export function HeaderActions({ children }) {
  const { node } = useContext(Ctx)
  if (!node) return null
  return createPortal(children, node)
}
