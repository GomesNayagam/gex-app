import { useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"

export default function AppShell({ children, gexData }) {
  const { elapsed, REFRESH_INTERVAL, loading, error, refresh, bumpRefreshKey, data } = gexData ?? {}
  const { pathname } = useLocation()

  const isB3 = pathname === "/b3" || pathname === "/"
  const onRefresh = isB3 ? refresh : bumpRefreshKey

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          elapsed={elapsed}
          total={REFRESH_INTERVAL}
          loading={isB3 ? loading : false}
          error={error}
          onRefresh={onRefresh}
          source={data?.source}
        />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
