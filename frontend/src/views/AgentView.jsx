import { useAISessions } from "@/hooks/useAISessions"
import { AgentSidebar } from "@/components/ai/AgentSidebar"
import { AgentChat } from "@/components/ai/AgentChat"

export default function AgentView() {
  const {
    sessions,
    activeId,
    activeSession,
    setActiveId,
    newSession,
    renameSession,
    deleteSession,
    setSessionModel,
    sendMessage,
    loading,
    copyMessage,
    exportSession,
    setMessageFeedback,
  } = useAISessions()

  return (
    <div className="flex h-full overflow-hidden">
      <AgentSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newSession}
        onRename={renameSession}
        onDelete={deleteSession}
      />
      <AgentChat
        session={activeSession}
        loading={loading}
        onSend={sendMessage}
        onExport={exportSession}
        onModelChange={setSessionModel}
        onCopyMessage={copyMessage}
        onFeedback={(messageId, feedback) => setMessageFeedback(activeSession?.id, messageId, feedback)}
      />
    </div>
  )
}
