/** Search authorized server history and return an exact message target to the dashboard. */
import { useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { useCallback, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { api, DirectoryOptions } from "@/services/api";
import { BrutalButton } from "./brutal/BrutalButton";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";

interface Props {
  channelId: string;
  channelName: string;
  onClose: () => void;
  onSelectMessage: (channelId: string, messageId: string) => void;
}
export function MessageSearchModal({
  channelId,
  channelName,
  onClose,
  onSelectMessage,
}: Props) {
  const styles = useBrutalStyles(createStyles);
  const [workspaceScope, setWorkspaceScope] = useState(false);
  const [query, setQuery] = useState("");
  const load = useCallback(
    (options: DirectoryOptions) =>
      api.searchMessages({
        ...options,
        channelId: workspaceScope ? undefined : channelId,
      }),
    [workspaceScope, channelId],
  );
  const results = useDirectory(load, query.trim().length >= 2);
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Search messages</Text>
            <BrutalButton
              title="Close"
              size="sm"
              variant="outline"
              onPress={onClose}
            />
          </View>
          <FlatList
            data={query.trim().length >= 2 ? results.page?.data || [] : []}
            keyExtractor={(item) => item.message.id}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            ListHeaderComponent={
              <View style={styles.stack}>
                <Text style={styles.copy}>
                  Search the full server history, including messages outside the
                  current page.
                </Text>
                <View style={styles.row}>
                  <Text style={styles.copy}>All accessible group chats</Text>
                  <Switch
                    accessibilityLabel="Search all group chats"
                    value={workspaceScope}
                    onValueChange={(value) => {
                      setWorkspaceScope(value);
                      results.first();
                    }}
                  />
                </View>
                <Text style={styles.copy}>
                  {workspaceScope ? "Group search" : `Searching ${channelName}`}
                </Text>
                <DirectoryControls
                  label="Search messages (at least 2 characters)"
                  query={query}
                  onSearch={(value) => {
                    setQuery(value);
                    results.search(value);
                  }}
                  loading={query.trim().length >= 2 && results.loading}
                  error={results.error}
                  onRetry={results.reload}
                  canPrevious={results.canPrevious}
                  hasMore={Boolean(results.page?.hasMore)}
                  onPrevious={results.previous}
                  onNext={results.next}
                  onFirst={results.first}
                  isFirst={results.isFirst}
                />
              </View>
            }
            ListEmptyComponent={
              !results.loading || query.trim().length < 2 ? (
                <Text style={styles.copy}>
                  {query.trim().length < 2
                    ? "Enter at least 2 characters to search."
                    : results.error
                      ? ""
                      : "No matching messages."}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.heading}>
                  {item.channel.name} · {item.message.sender.name}
                </Text>
                <Text style={styles.date}>
                  {new Date(item.message.timestamp).toLocaleString()}
                </Text>
                {item.message.content ? (
                  <Text selectable style={styles.message}>
                    {item.message.content}
                  </Text>
                ) : null}
                {item.message.codeSnippet ? (
                  <Text selectable style={styles.code}>
                    {item.message.codeSnippet.language}:{" "}
                    {item.message.codeSnippet.code}
                  </Text>
                ) : null}
                <BrutalButton
                  title="Open message in conversation"
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    onSelectMessage(item.channel.id, item.message.id);
                    onClose();
                  }}
                />
              </View>
            )}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: BrutalColors.bgPaper },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderColor: BrutalColors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: {
      flex: 1,
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 18,
      color: BrutalColors.ink,
    },
    body: { padding: 20, gap: 16 },
    stack: { gap: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
    },
    card: {
      padding: 16,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      backgroundColor: BrutalColors.bgCard,
      gap: 12,
    },
    heading: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 14,
      color: BrutalColors.ink,
    },
    copy: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      color: BrutalColors.inkSecondary,
    },
    code: { fontFamily: Fonts.mono, fontSize: 13, color: BrutalColors.ink },
    message: {
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 25,
      color: BrutalColors.ink,
    },
    date: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      color: BrutalColors.inkMuted,
    },
  });
