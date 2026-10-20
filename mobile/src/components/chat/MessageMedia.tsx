import { useEffect, useRef, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable as Pressable } from "../ui/MotionPressable";
import { File, Paths } from "expo-file-system";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { api, getApiBaseUrl, getSessionToken } from "@/services/api";
import type { MediaAsset } from "@/types/chat";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
import { useMediaPreview } from "./MediaPreviewContext";

async function downloadAsset(
  asset: Pick<MediaAsset, "id" | "name">,
  signal: AbortSignal,
) {
  if (Platform.OS === "web")
    throw new Error("Open media in the Fable web app.");
  const token = await getSessionToken();
  if (!token) throw new Error("Please sign in again.");
  const workspaceId = api.getSelectedWorkspaceId();
  const file = new File(
    Paths.cache,
    `fable-${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2)}-${asset.name}`,
  );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", cancel, { once: true });
  const deadline = setTimeout(() => controller.abort(), 30000);
  const task = File.createDownloadTask(
    `${getApiBaseUrl()}/media/${encodeURIComponent(asset.id)}`,
    file,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
      },
      signal: controller.signal,
      sessionType: "foreground",
    },
  );
  try {
    if (!(await task.downloadAsync()))
      throw new Error("Attachment download was paused. Please retry.");
    return file;
  } catch (error) {
    if (file.exists) file.delete();
    if (controller.signal.aborted && !signal.aborted)
      throw new Error("The attachment download timed out. Please retry.");
    throw error;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", cancel);
    task.release();
  }
}

function VideoPlayback({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      style={{ width: 230, height: 240, borderRadius: 14 }}
    />
  );
}
function AudioPlayback({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const colors = useBrutalTheme();
  const [error, setError] = useState("");
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? "Pause audio message" : "Play audio message"
        }
        style={{
          padding: 14,
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
        onPress={async () => {
          try {
            setError("");
            if (status.playing) player.pause();
            else {
              if (status.didJustFinish) await player.seekTo(0);
              player.play();
            }
          } catch {
            setError("Audio could not be played on this device.");
          }
        }}
      >
        <AppIcon name={status.playing ? "pause" : "play"} size={24} />
        <Text style={{ color: colors.primary }}>
          {status.playing ? "Pause" : "Play"} · {Math.floor(status.currentTime)}{" "}
          / {Math.floor(status.duration)}s
        </Text>
      </Pressable>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.accentPink }}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function MessageMedia({ asset }: { asset: MediaAsset }) {
  const preview = useMediaPreview();
  const colors = useBrutalTheme();
  return preview.active === asset.id ? (
    <MediaContent asset={asset} />
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${asset.name}`}
      onPress={() => preview.select(asset.id)}
      style={{
        padding: 14,
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: colors.bgCardAlt,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AppIcon name="document" size={22} />
        <Text
          style={{ color: colors.primary, fontWeight: "600", flexShrink: 1 }}
        >
          {asset.name}
        </Text>
      </View>
      <Text style={{ color: colors.inkMuted, fontSize: 12 }}>
        {Math.ceil(asset.size / 1024)} KB · Open attachment
      </Text>
    </Pressable>
  );
}
function MediaContent({ asset }: { asset: MediaAsset }) {
  const colors = useBrutalTheme();
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const fileRef = useRef<File | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      downloadController.current?.abort();
      if (fileRef.current?.exists) fileRef.current.delete();
    };
  }, []);
  const load = async () => {
    downloadController.current?.abort();
    const controller = new AbortController();
    downloadController.current = controller;
    setBusy(true);
    setError("");
    try {
      const file = await downloadAsset(asset, controller.signal);
      if (!alive.current) {
        if (file.exists) file.delete();
        return;
      }
      fileRef.current = file;
      setUri(file.uri);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Attachment could not be opened.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    downloadController.current = controller;
    void downloadAsset({ id: asset.id, name: asset.name }, controller.signal)
      .then((file) => {
        if (!mounted) {
          if (file.exists) file.delete();
          return;
        }
        fileRef.current = file;
        setUri(file.uri);
      })
      .catch((failure) => {
        if (mounted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Attachment could not be opened.",
          );
      })
      .finally(() => {
        if (mounted) setBusy(false);
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [asset.id, asset.name]);
  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: colors.bgCardAlt,
        marginTop: 6,
        maxWidth: "100%",
      }}
    >
      {!uri && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${asset.name}`}
          disabled={busy}
          onPress={() => void load()}
          style={{ padding: 14, minHeight: 48 }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600" }}>
            {busy ? "Loading…" : asset.name}
          </Text>
          <Text style={{ color: colors.inkMuted, fontSize: 12 }}>
            {Math.ceil(asset.size / 1024)} KB
          </Text>
        </Pressable>
      )}
      {!!uri &&
        (asset.mimeType.startsWith("image/") ? (
          <Image
            source={{ uri }}
            accessibilityLabel={asset.name}
            resizeMode="contain"
            style={{ width: 230, height: 220, borderRadius: 14 }}
          />
        ) : asset.mimeType.startsWith("audio/") ||
          asset.name.startsWith("Voice message") ? (
          <AudioPlayback uri={uri} />
        ) : asset.mimeType.startsWith("video/") ? (
          <VideoPlayback uri={uri} />
        ) : (
          <Text style={{ color: colors.ink, padding: 12 }}>{asset.name}</Text>
        ))}
      {!!uri && (
        <Pressable
          accessibilityRole="button"
          style={{ padding: 14, minHeight: 48 }}
          onPress={async () => {
            try {
              if (!(await Sharing.isAvailableAsync()))
                throw new Error("File sharing is unavailable on this device.");
              await Sharing.shareAsync(uri, {
                mimeType: asset.mimeType,
                dialogTitle: asset.name,
              });
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Could not share this file.",
              );
            }
          }}
        >
          <Text style={{ color: colors.primary }}>
            Save or open in another app
          </Text>
        </Pressable>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.accentPink, padding: 12 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
