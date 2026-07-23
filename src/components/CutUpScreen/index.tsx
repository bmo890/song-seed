import { SparkTextScaleProvider } from "../common/sparkTextScale";
import { CutUpScreenContent } from "./components/CutUpScreenContent";

export function CutUpScreen() {
  return (
    <SparkTextScaleProvider>
      <CutUpScreenContent />
    </SparkTextScaleProvider>
  );
}
