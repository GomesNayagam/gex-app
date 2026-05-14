import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AppShell from "@/components/shell/AppShell"
import { useGEXData } from "@/hooks/useGEXData"
import B3Mode from "@/views/B3Mode"
import WatchlistMode from "@/views/WatchlistMode"
import ExpiryMode from "@/views/ExpiryMode"
import Settings from "@/views/Settings"

export default function App() {
  const gexData = useGEXData()
  return (
    <BrowserRouter>
      <AppShell gexData={gexData}>
        <Routes>
          <Route path="/b3" element={<B3Mode gexData={gexData} />} />
          <Route path="/watch" element={<WatchlistMode />} />
          <Route path="/expiry" element={<ExpiryMode />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/b3" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
