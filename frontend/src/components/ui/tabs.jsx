import { createContext, useContext, useState } from "react"
import { cn } from "@/lib/utils"

const TabsCtx = createContext(null)

export function Tabs({ defaultValue, value, onValueChange, className, children }) {
  const [internal, setInternal] = useState(defaultValue)
  const active = value ?? internal
  const setActive = onValueChange ?? setInternal
  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ className, ...props }) {
  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

export function TabsTrigger({ value, className, ...props }) {
  const { active, setActive } = useContext(TabsCtx)
  const isActive = active === value
  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        "rounded-full px-3 py-1 text-[10px] font-mono transition-colors duration-150",
        isActive
          ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
          : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
        className
      )}
      {...props}
    />
  )
}

export function TabsContent({ value, className, children }) {
  const { active } = useContext(TabsCtx)
  if (active !== value) return null
  return <div className={cn("mt-3", className)}>{children}</div>
}
