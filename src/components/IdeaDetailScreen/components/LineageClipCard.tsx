import { ClipCard, type ClipCardContextProps, type ClipCardEntry } from "../ClipCard";

type LineageClipCardProps = {
  entry: ClipCardEntry;
  context: ClipCardContextProps;
  displayOnly?: boolean;
};

export function LineageClipCard(props: LineageClipCardProps) {
  return <ClipCard {...props} />;
}
