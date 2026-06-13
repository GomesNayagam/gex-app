import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import { HeaderActionsProvider } from "./HeaderActions"

export default function AppShell({ children }) {
  return (
    <HeaderActionsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </HeaderActionsProvider>
  )
}
