import { useEffect, useState } from "react";
import { Image, View, type ImageSourcePropType } from "react-native";
import { api, getApiBaseUrl, getSessionToken } from "@/services/api";
import type { User } from "@/types/chat";
import { MonogramAvatar } from "../brutal/MonogramAvatar";
import { subscribeRealtime } from "@/services/realtime";

export function UserAvatar({
  user,
  size = 46,
  self = false,
}: {
  user: User;
  size?: number;
  self?: boolean;
}) {
  const [loaded, setLoaded] = useState<{
    version: string;
    source: ImageSourcePropType;
  } | null>(null);
  const [refreshedVersion, setRefreshedVersion] = useState<{
    id: string;
    base: number;
    version: number;
  } | null>(null);
  const photoVersion =
    refreshedVersion?.id === user.id &&
    refreshedVersion.base === (user.photoVersion ?? 0)
      ? refreshedVersion.version
      : (user.photoVersion ?? 0);
  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type !== "profile.updated" || event.targetId !== user.id)
        return;
      void api
        .fetchGlobalProfiles([user.id])
        .then((profiles) => {
          if (alive)
            setRefreshedVersion({
              id: user.id,
              base: user.photoVersion ?? 0,
              version: profiles[0]?.photoVersion ?? 0,
            });
        })
        .catch(() => {
          /* The initials remain visible if this authorized refresh fails. */
        });
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [user.id, user.photoVersion]);
  const version = `${user.id}:${photoVersion}:${self}`;
  const source =
    photoVersion && loaded?.version === version ? loaded.source : null;
  useEffect(() => {
    let alive = true;
    if (photoVersion)
      void getSessionToken()
        .then((token) => {
          if (!alive || !token) return;
          const workspace = api.getSelectedWorkspaceId();
          setLoaded({
            version,
            source: {
              uri: `${getApiBaseUrl()}${self ? "/auth/profile/photo" : `/contacts/profiles/${encodeURIComponent(user.id)}/photo`}?v=${photoVersion}`,
              headers: {
                Authorization: `Bearer ${token}`,
                ...(workspace ? { "X-Workspace-Id": workspace } : {}),
              },
            },
          });
        })
        .catch(() => {
          /* A failed photo lookup retains this real user's initials. */
        });
    return () => {
      alive = false;
    };
  }, [user.id, photoVersion, self, version]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <MonogramAvatar
        monogram={user.monogram}
        backgroundColor={user.avatarColor}
        size={size}
      />
      {source && (
        <Image
          source={source}
          style={{ position: "absolute", width: size, height: size }}
          onError={() => setLoaded(null)}
          accessible={false}
        />
      )}
    </View>
  );
}
