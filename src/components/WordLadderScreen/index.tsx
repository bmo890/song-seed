import { SparkTextScaleProvider } from "../common/sparkTextScale";
import { WordLadderScreenContent } from "./components/WordLadderScreenContent";

export function WordLadderScreen() {
  return (
    <SparkTextScaleProvider>
      <WordLadderScreenContent />
    </SparkTextScaleProvider>
  );
}
