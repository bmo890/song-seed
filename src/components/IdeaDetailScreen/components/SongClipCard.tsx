import { ClipCard, type ClipCardContextProps, type ClipCardEntry, type ClipCardFold } from "./ClipCard";

type SongClipCardProps = {
  entry: ClipCardEntry;
  context: ClipCardContextProps;
  displayOnly?: boolean;
  displayPrimary?: boolean;
  fold?: ClipCardFold;
  stacked?: boolean;
};

export function SongClipCard(props: SongClipCardProps) {
  return <ClipCard {...props} />;
}
