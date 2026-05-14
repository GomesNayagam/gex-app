import Sidebar from "./Sidebar"
import TopBar from "./TopBar"

export default function AppShell({ children, gexData }) {
  const { elapsed, REFRESH_INTERVAL, loading, error, refresh, data } = gexData ?? {}

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          elapsed={elapsed}
          total={REFRESH_INTERVAL}
          loading={loading}
          error={error}
          onRefresh={refresh}
          source={data?.source}
        />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
