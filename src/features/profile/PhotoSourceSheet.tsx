import { BottomSheet, SheetAction } from '@/components/Overlay';
import type { PhotoSource } from '@/lib/media';

/** "Take a photo" / "Choose from gallery". */
export function PhotoSourceSheet({ visible, onClose, onPick, title = 'Add a photo' }: { visible: boolean; onClose: () => void; onPick: (s: PhotoSource) => void; title?: string }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <SheetAction icon="camera-outline" label="Take a photo" onPress={() => { onClose(); setTimeout(() => onPick('camera'), 250); }} />
      <SheetAction icon="images-outline" label="Choose from gallery" onPress={() => { onClose(); setTimeout(() => onPick('library'), 250); }} />
    </BottomSheet>
  );
}
