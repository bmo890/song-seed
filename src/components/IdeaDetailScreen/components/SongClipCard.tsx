import { ClipCard, type ClipCardContextProps, type ClipCardEntry } from "../ClipCard";

type SongClipCardProps = {
  entry: ClipCardEntry;
  context: ClipCardContextProps;
  displayOnly?: boolean;
};

export function SongClipCard(props: SongClipCardProps) {
  return <ClipCard {...props} />;
}
