import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import { ChatWidget } from "@/components/ai/ChatWidget"

export default function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}
