import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Keyboard, Platform, Text, View } from "react-native";
import { choosePhoto } from "@/services/photos";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable as Pressable } from "../ui/MotionPressable";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { api } from "@/services/api";
import type { MediaAsset } from "@/types/chat";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";

function removeTemporaryFile(uri: string) {
  const file = new File(uri);
  const cacheRoot = Paths.cache.uri.replace(/\/$/, "") + "/";
  if (file.uri.startsWith(cacheRoot) && file.exists) file.delete();
}

export function MediaComposer({
  channelId,
  disabled,
  assets,
  onUploaded,
  onRemoved,
  onBusy,
  children,
  endControl,
}: {
  channelId: string;
  disabled: boolean;
  assets: MediaAsset[];
  onUploaded: (asset: MediaAsset) => void;
  onRemoved: (id: string) => void;
  onBusy: (busy: boolean) => void;
  children: ReactNode;
  endControl?: ReactNode;
}) {
  const colors = useBrutalTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [pending, setPending] = useState<{ name: string; uri: string } | null>(
    null,
  );
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const recording = useRef(false);
  const recordingOperation = useRef(false);
  const localFiles = useRef(new Set<string>());
  const chooseAttachment = async (source: "library" | "file") => {
    if (inFlight.current || recordingOperation.current) return;
    setAttachmentMenu(false);
    setError("");
    try {
      if (source === "library") {
        const photo = await choosePhoto("library");
        if (photo && mounted.current) await upload(photo.name, photo.uri);
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (!result.canceled && result.assets[0] && mounted.current)
          await upload(result.assets[0].name, result.assets[0].uri);
      }
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Couldn't choose this attachment.",
        );
    }
  };
  const upload = async (name: string, uri: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setPending({ name, uri });
    try {
      if (Platform.OS === "web")
        throw new Error("Use the Fable web app to attach media in a browser.");
      const file = new File(uri);
      localFiles.current.add(uri);
      if (!file.size || file.size > 10 * 1024 * 1024) {
        setPending(null);
        removeTemporaryFile(uri);
        localFiles.current.delete(uri);
        throw new Error("Choose a nonempty file up to 10 MB.");
      }
      const asset = await api.uploadMedia(
        channelId,
        name,
        await file.arrayBuffer(),
      );
      if (mounted.current) {
        onUploaded(asset);
        setPending(null);
      }
      // Only remove the app's cache copy; a user's original file is never a target.
      try {
        removeTemporaryFile(uri);
        localFiles.current.delete(uri);
      } catch {
        if (mounted.current)
          setError(
            "Attachment uploaded. The local cache copy could not be removed.",
          );
      }
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Upload failed. Retry to send your file.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  };
  const stop = async () => {
    if (!recording.current || recordingOperation.current) return;
    recordingOperation.current = true;
    setBusy(true);
    onBusy(true);
    recording.current = false;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (mounted.current) {
        if (!recorder.uri)
          throw new Error(
            "The recording did not produce an audio file. Please try again.",
          );
        await upload("Voice message.m4a", recorder.uri);
      }
    } catch (failure) {
      if (mounted.current) {
        onBusy(false);
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not finish recording.",
        );
      }
    } finally {
      recordingOperation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const toggle = async () => {
    if (recordingOperation.current || inFlight.current) return;
    if (recording.current) {
      await stop();
      return;
    }
    recordingOperation.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Microphone access is needed to record. Enable it in your device settings.",
        );
      if (!mounted.current) return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      await recorder.prepareToRecordAsync();
      if (!mounted.current || AppState.currentState !== "active") {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        if (mounted.current) onBusy(false);
        return;
      }
      recording.current = true;
      recorder.record();
    } catch (failure) {
      if (mounted.current) {
        onBusy(false);
        setError(
          failure instanceof Error
            ? failure.message
            : "Recording could not start.",
        );
      }
    } finally {
      recordingOperation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const stopRef = useRef(stop);
  useLayoutEffect(() => {
    stopRef.current = stop;
  });
  useEffect(() => {
    if (!status.isRecording) return;
    const timer = setTimeout(
      () => void stopRef.current(),
      Math.max(0, 120000 - status.durationMillis),
    );
    return () => clearTimeout(timer);
  }, [status.isRecording, status.durationMillis]);
  useEffect(() => {
    mounted.current = true;
    const temporaryFiles = localFiles.current;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && recording.current) void stopRef.current();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      for (const uri of temporaryFiles) {
        try {
          removeTemporaryFile(uri);
        } catch {
          /* Protected OS cache remains eligible for system reclamation. */
        }
      }
      temporaryFiles.clear();
      if (recording.current) {
        recording.current = false;
        void recorder
          .stop()
          .then(() => setAudioModeAsync({ allowsRecording: false }))
          .catch(() => {
            /* Recorder hook releases the native resource on unmount. */
          });
      }
    };
  }, [recorder]);
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 6,
        gap: 6,
        backgroundColor: colors.chatBackground,
      }}
    >
      {attachmentMenu && (
        <View
          accessibilityLabel="Choose attachment source"
          style={{
            flexDirection: "row",
            gap: 12,
            padding: 12,
            borderRadius: 18,
            backgroundColor: colors.chatReceived,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => void chooseAttachment("library")}
            style={{ flex: 1, alignItems: "center", gap: 6, padding: 12 }}
          >
            <AppIcon name="photos" size={28} color={colors.chatAccent} />
            <Text style={{ color: colors.chatInk }}>Photo library</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void chooseAttachment("file")}
            style={{ flex: 1, alignItems: "center", gap: 6, padding: 12 }}
          >
            <AppIcon name="document" size={28} color={colors.chatAccent} />
            <Text style={{ color: colors.chatInk }}>Files</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close attachment choices"
            onPress={() => setAttachmentMenu(false)}
            style={{ padding: 12 }}
          >
            <AppIcon name="close" size={22} />
          </Pressable>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            borderRadius: 25,
            backgroundColor: colors.chatReceived,
            paddingLeft: 4,
            paddingRight: 2,
          }}
        >
          {children}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach photo, video or file"
            disabled={
              disabled || busy || status.isRecording || assets.length >= 4
            }
            style={{ padding: 12, minHeight: 48, minWidth: 48 }}
            onPress={() => {
              Keyboard.dismiss();
              setAttachmentMenu((value) => !value);
            }}
          >
            <AppIcon name="attach" size={24} color={colors.chatMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take a photo for this chat"
            disabled={
              disabled || busy || status.isRecording || assets.length >= 4
            }
            style={{
              minHeight: 48,
              minWidth: 42,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={async () => {
              if (inFlight.current || recordingOperation.current) return;
              setBusy(true);
              onBusy(true);
              setError("");
              try {
                const photo = await choosePhoto("camera");
                if (photo && mounted.current)
                  await upload(photo.name, photo.uri);
              } catch (failure) {
                if (mounted.current)
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Couldn't take this photo.",
                  );
              } finally {
                if (mounted.current) {
                  setBusy(false);
                  onBusy(false);
                }
              }
            }}
          >
            <AppIcon name="camera" size={24} color={colors.chatMuted} />
          </Pressable>
        </View>
        {status.isRecording || !endControl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              status.isRecording ? "Stop recording" : "Record audio message"
            }
            disabled={disabled || busy || assets.length >= 4}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: status.isRecording
                ? colors.dangerButton
                : colors.chatAccent,
            }}
            onPress={() => void toggle()}
          >
            <AppIcon
              name={status.isRecording ? "stop" : "microphone"}
              size={25}
              color="#FFFFFF"
            />
          </Pressable>
        ) : (
          endControl
        )}
      </View>
      {status.isRecording ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.dangerButton, padding: 6 }}
        >
          Recording · {Math.floor(status.durationMillis / 1000)}s
        </Text>
      ) : busy ? (
        <Text style={{ color: colors.chatMuted, padding: 6 }}>
          Preparing attachment…
        </Text>
      ) : null}
      {assets.map((asset) => (
        <View
          key={asset.id}
          style={{
            backgroundColor: colors.bgCardAlt,
            borderRadius: 12,
            paddingLeft: 12,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text numberOfLines={1} style={{ flex: 1, color: colors.ink }}>
            {asset.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${asset.name}`}
            disabled={busy || disabled || status.isRecording}
            style={{ padding: 16 }}
            onPress={async () => {
              setBusy(true);
              onBusy(true);
              try {
                await api.discardMedia(asset.id);
                onRemoved(asset.id);
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Could not remove this attachment.",
                );
              } finally {
                setBusy(false);
                onBusy(false);
              }
            }}
          >
            <AppIcon name="close" size={21} />
          </Pressable>
        </View>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.accentPink }}>
          {error}
        </Text>
      )}
      {pending && !busy && (
        <Pressable
          accessibilityRole="button"
          style={{ padding: 12 }}
          onPress={() => void upload(pending.name, pending.uri)}
        >
          <Text style={{ color: colors.primary }}>Retry upload</Text>
        </Pressable>
      )}
    </View>
  );
}
