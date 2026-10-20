import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";

export interface PhotoDraft { uri: string; name: string; }

export async function choosePhoto(source: "camera" | "library", profile = false): Promise<PhotoDraft | null> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Allow camera access in your phone’s settings to take a photo.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: profile, aspect: [1, 1], quality: 0.9, exif: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const original = result.assets[0];
  const context = ImageManipulator.manipulate(original.uri);
  const edge = profile ? 512 : 2048;
  if (Math.max(original.width, original.height) > edge) context.resize(original.width > original.height ? { width: edge } : { height: edge });
  let rendered;
  try {
    rendered = await context.renderAsync();
    const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: profile ? 0.8 : 0.85 });
    return { uri: photo.uri, name: `Photo-${Date.now()}.jpg` };
  } finally { rendered?.release(); context.release(); }
}

export async function photoBytes(photo: PhotoDraft, maximum = 10 * 1024 * 1024) {
  const file = new File(photo.uri);
  if (!file.size || file.size > maximum) throw new Error(`Choose a photo smaller than ${maximum / 1024 / 1024} MB.`);
  return file.arrayBuffer();
}

export function releasePhoto(photo: PhotoDraft | null) {
  if (!photo) return;
  const file = new File(photo.uri);
  if (file.exists) file.delete();
}
