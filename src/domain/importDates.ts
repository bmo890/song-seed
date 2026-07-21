import type { ImportedAudioAsset } from "../services/audioStorage";
import { AppAlert } from "../components/common/AppAlert";
import { i18n } from "../i18n/instance";

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
  return new Date(timestamp).toLocaleDateString(i18n.language === "he" ? "he-IL" : "en-US", {
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
    return i18n.t("importDates.dateImport");
  }

  if (summary.totalCount === 1) {
    return i18n.t("importDates.dateOriginal", { date: summary.previewLabel });
  }

  if (summary.availableCount === summary.totalCount) {
    return i18n.t("importDates.datesOriginal", { date: summary.previewLabel });
  }

  return i18n.t("importDates.datesPartial", { available: summary.availableCount, total: summary.totalCount, date: summary.previewLabel });
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
  title = i18n.t("importDates.title")
): Promise<ImportDatePreference | null> {
  const summary = summarizeImportSourceDates(assets);
  if (!summary.hasSourceDate) {
    return "import";
  }

  const message =
    summary.totalCount === 1
      ? i18n.t("importDates.oneMessage", { date: summary.previewLabel })
      : summary.availableCount === summary.totalCount
        ? i18n.t("importDates.allMessage", { date: summary.previewLabel })
        : i18n.t("importDates.partialMessage", { available: summary.availableCount, total: summary.totalCount, date: summary.previewLabel });

  return new Promise((resolve) => {
    AppAlert.custom(title, message, [
      {
        label: i18n.t("importDates.original"),
        description: i18n.t("importDates.originalHint"),
        icon: "calendar-outline",
        style: "default",
        onPress: () => resolve("source"),
      },
      {
        label: i18n.t("importDates.today"),
        description: i18n.t("importDates.todayHint"),
        icon: "time-outline",
        style: "default",
        onPress: () => resolve("import"),
      },
      {
        label: i18n.t("common.cancel"),
        style: "cancel",
        onPress: () => resolve(null),
      },
    ]);
  });
}
