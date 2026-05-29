import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AppShell from "@/components/shell/AppShell"
import B3Mode from "@/views/B3Mode"
import WatchlistMode from "@/views/WatchlistMode"
import ExpiryMode from "@/views/ExpiryMode"
import Settings from "@/views/Settings"
import UOAMode from "@/views/UOAMode"

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/b3" element={<B3Mode />} />
          <Route path="/watch" element={<WatchlistMode />} />
          <Route path="/expiry" element={<ExpiryMode />} />
          <Route path="/uoa" element={<UOAMode />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/b3" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
