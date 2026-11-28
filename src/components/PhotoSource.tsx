import { BottomSheet, SheetAction } from './Overlay';
import type { PhotoSource } from '@/lib/media';

export function PhotoSourceSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (s: PhotoSource) => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <SheetAction icon="camera-outline" label="📷  Camera" onPress={() => { onClose(); setTimeout(() => onPick('camera'), 250); }} />
      <SheetAction icon="images-outline" label="🖼️  Gallery" onPress={() => { onClose(); setTimeout(() => onPick('library'), 250); }} />
    </BottomSheet>
  );
}
