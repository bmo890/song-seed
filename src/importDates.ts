import { Alert } from "react-native";
import type { ImportedAudioAsset } from "./services/audioStorage";

export type ImportDatePreference = "source" | "import";

export type ImportedAssetDateMetadata = {
  createdAt: number;
  importedAt: number;
  sourceCreatedAt?: number;
};

type ImportSourceDateSummary = {
  hasSourceDate: boolean;
  totalCount: number;
  availableCount: number;
  previewLabel?: string;
};

function formatImportDateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function summarizeImportSourceDates(
  assets: Array<Pick<ImportedAudioAsset, "sourceCreatedAt">>
): ImportSourceDateSummary {
  const sourceDates = assets
    .map((asset) => asset.sourceCreatedAt)
    .filter((timestamp): timestamp is number => Number.isFinite(timestamp));

  if (sourceDates.length === 0) {
    return {
      hasSourceDate: false,
      totalCount: assets.length,
      availableCount: 0,
    };
  }

  return {
    hasSourceDate: true,
    totalCount: assets.length,
    availableCount: sourceDates.length,
    previewLabel: formatImportDateLabel(Math.min(...sourceDates)),
  };
}

export function describeImportDatePreference(
  assets: Array<Pick<ImportedAudioAsset, "sourceCreatedAt">>,
  preference: ImportDatePreference
) {
  const summary = summarizeImportSourceDates(assets);

  if (preference === "import" || !summary.hasSourceDate) {
    return "Date: Import date";
  }

  if (summary.totalCount === 1) {
    return `Date: Original file date (${summary.previewLabel})`;
  }

  if (summary.availableCount === summary.totalCount) {
    return `Date: Original file dates (earliest ${summary.previewLabel})`;
  }

  return `Date: Original file dates when available (${summary.availableCount}/${summary.totalCount}, earliest ${summary.previewLabel})`;
}

export function buildImportedAssetDateMetadata(
  assets: Array<Pick<ImportedAudioAsset, "sourceCreatedAt">>,
  preference: ImportDatePreference,
  importedAt: number
): ImportedAssetDateMetadata[] {
  return assets.map((asset, index) => {
    const baseCreatedAt =
      preference === "source" && typeof asset.sourceCreatedAt === "number"
        ? asset.sourceCreatedAt
        : importedAt;

    return {
      createdAt: baseCreatedAt + index,
      importedAt,
      sourceCreatedAt: asset.sourceCreatedAt,
    };
  });
}

export function buildImportedIdeaDateMetadata(items: ImportedAssetDateMetadata[]): ImportedAssetDateMetadata {
  const createdAt = Math.min(...items.map((item) => item.createdAt));
  const importedAt = Math.max(...items.map((item) => item.importedAt));
  const sourceDates = items
    .map((item) => item.sourceCreatedAt)
    .filter((timestamp): timestamp is number => Number.isFinite(timestamp));

  return {
    createdAt,
    importedAt,
    sourceCreatedAt: sourceDates.length > 0 ? Math.min(...sourceDates) : undefined,
  };
}

export function buildImportHelperText(
  baseText: string,
  assets: Array<Pick<ImportedAudioAsset, "sourceCreatedAt">>,
  preference: ImportDatePreference
) {
  return `${baseText}\n${describeImportDatePreference(assets, preference)}`;
}

export async function promptForImportDatePreference(
  assets: Array<Pick<ImportedAudioAsset, "sourceCreatedAt">>,
  title = "Import audio"
): Promise<ImportDatePreference | null> {
  const summary = summarizeImportSourceDates(assets);
  if (!summary.hasSourceDate) {
    return "import";
  }

  const message =
    summary.totalCount === 1
      ? `Original file date: ${summary.previewLabel}\nChoose which date Song Seed should use for chronology.`
      : summary.availableCount === summary.totalCount
        ? `Earliest original file date: ${summary.previewLabel}\nChoose which date Song Seed should use for chronology.`
        : `Original file dates are available for ${summary.availableCount} of ${summary.totalCount} files.\nEarliest original file date: ${summary.previewLabel}\nFiles without one will use import date.`;

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: "Use original file date",
        onPress: () => resolve("source"),
      },
      {
        text: "Use import date",
        onPress: () => resolve("import"),
      },
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => resolve(null),
      },
    ]);
  });
}
