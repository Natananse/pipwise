import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type ChartUpload = { name: string; uri: string; mimeType: string; size: number; text?: string; base64?: string };
/** Only user-picked files are read. No gallery or full-storage permission. */
export async function pickChartUpload(): Promise<ChartUpload | null> {
  if (Platform.OS !== 'web' && (!requireOptionalNativeModule('ExpoDocumentPicker') || !requireOptionalNativeModule('FileSystem')))
    throw new Error('Install the updated Android build to choose files. You can paste CSV candles below in this installed version.');
  const picker = await import('expo-document-picker');
  const result = await picker.getDocumentAsync({ type: ['image/png', 'image/jpeg', 'image/webp', 'text/csv', 'text/plain', 'application/json', 'application/vnd.ms-excel'], multiple: false, copyToCacheDirectory: true, base64: false });
  if (result.canceled) return null;
  const selected = result.assets[0];
  let nativeFile: InstanceType<typeof import('expo-file-system').File> | undefined;
  try {
    if (Platform.OS !== 'web') {
      const { File } = await import('expo-file-system');
      nativeFile = new File(selected.uri);
    }
    const image = /\.(png|jpe?g|webp)$/i.test(selected.name);
    if (!image && !/\.(csv|json|txt)$/i.test(selected.name)) throw new Error('Choose a PNG, JPEG, WebP, OHLC CSV or JSON file.');
    const mimeType = image ? /\.png$/i.test(selected.name) ? 'image/png' : /\.webp$/i.test(selected.name) ? 'image/webp' : 'image/jpeg' : 'text/plain';
    const maximum = image ? 3 * 1024 * 1024 : 1024 * 1024;
    const size = nativeFile ? nativeFile.size : selected.file?.size ?? selected.size;
    if (size === undefined || !Number.isFinite(size) || size <= 0 || size > maximum)
      throw new Error(`Choose ${image ? 'an image under 3 MB' : 'a data file under 1 MB'}.`);
    if (!image) return { name: selected.name, uri: selected.uri, mimeType, size, text: selected.file ? await selected.file.text() : await nativeFile!.text() };
    let base64: string;
    if (selected.file) {
      base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(selected.file!); });
    } else base64 = await nativeFile!.base64();
    return { name: selected.name, uri: `data:${mimeType};base64,${base64}`, mimeType, size, base64 };
  } finally {
    // The picker copied into app cache. Delete our copy after reading it into
    // screen memory; never persist uploaded files or analysis in the wallet.
    if (nativeFile?.exists) nativeFile.delete();
    if (Platform.OS === 'web' && selected.uri.startsWith('blob:')) URL.revokeObjectURL(selected.uri);
  }
}
