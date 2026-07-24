import { FloatingActionDock } from "../../common/FloatingActionDock";

type ActionButtonsProps = {
  onQuickRecord: () => void;
  onDockLayout?: (height: number) => void;
};

/**
 * The collection's floating zone holds ONE action: Record. Creation (new song,
 * import, dev seeding) lives in the header's ⋯ overflow — big is earned by
 * being THE action, and on this screen that is capturing a clip.
 */
export function ActionButtons({ onQuickRecord, onDockLayout }: ActionButtonsProps) {
  return (
    <FloatingActionDock
      onDockLayout={onDockLayout}
      onRecord={onQuickRecord}
      menuItems={[]}
    />
  );
}
