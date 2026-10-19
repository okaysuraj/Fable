/** Render the selected text room and its history controls; legacy room types remain explicit. */
import React from "react";
import { Channel, Message, User } from "../types/chat";
import { ChatView } from "./chat/ChatView";
interface MainStageProps {
  hasMore: boolean;
  historyLoading: boolean;
  onLoadOlder: () => void;
  hasNewer: boolean;
  archiveMode: boolean;
  onLoadNewer: () => void;
  onLoadLatest: () => void;
  channel: Channel;
  messages: Message[];
  pins: Message[];
  onMessageActions: (message: Message) => void;
  currentUser: User;
  onSendMessage: (content: string, clientMutationId: string) => Promise<void>;
  onToggleReaction: (messageId: string, icon: string) => void;
  onSearchMessages: () => void;
  anchorMessageId?: string;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
}

export const MainStage: React.FC<MainStageProps> = ({
  channel,
  messages,
  pins,
  onMessageActions,
  currentUser,
  onSendMessage,
  onToggleReaction,
  onSearchMessages,
  anchorMessageId,
  onToggleDrawer,
  isDrawerOpen,
  hasMore,
  historyLoading,
  onLoadOlder,
  hasNewer,
  archiveMode,
  onLoadNewer,
  onLoadLatest,
}) => (
  <div
    role="main"
    className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden"
  >
    <ChatView
      channel={channel}
      messages={messages}
      pins={pins}
      onMessageActions={onMessageActions}
      currentUser={currentUser}
      onSendMessage={onSendMessage}
      onToggleReaction={onToggleReaction}
      onSearchMessages={onSearchMessages}
      anchorMessageId={anchorMessageId}
      onToggleDrawer={onToggleDrawer}
      isDrawerOpen={isDrawerOpen}
      hasMore={hasMore}
      historyLoading={historyLoading}
      onLoadOlder={onLoadOlder}
      hasNewer={hasNewer}
      archiveMode={archiveMode}
      onLoadNewer={onLoadNewer}
      onLoadLatest={onLoadLatest}
    />
  </div>
);
