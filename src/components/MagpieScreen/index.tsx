import { SparkTextScaleProvider } from "../common/sparkTextScale";
import { MagpieScreenContent } from "./components/MagpieScreenContent";

export function MagpieScreen() {
  return (
    <SparkTextScaleProvider>
      <MagpieScreenContent />
    </SparkTextScaleProvider>
  );
}
