import { IdeaListFilterSection } from "../components/IdeaListFilterSection";
import { IdeaListNestedCollectionsSection } from "../components/IdeaListNestedCollectionsSection";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { getDateBucket } from "../../../dateBuckets";
import { getIdeaSortTimestamp } from "../../../ideaSort";
import { openCollectionInBrowse } from "../../../navigation";

export function CollectionFilterSection() {
  const { screen, management, store } = useCollectionScreen();

  const isIdeaHiddenByDay = (idea: any) =>
    screen.activeTimelineMetric
      ? screen.hiddenDayKeySet.has(
          `${screen.activeTimelineMetric}:${getDateBucket(getIdeaSortTimestamp(idea, store.ideasSort)).startTs}`
        )
      : false;
  const isIdeaEffectivelyHidden = (idea: any) =>
    screen.hiddenIdeaIdsSet.has(idea.id) || isIdeaHiddenByDay(idea);
  const hiddenItemsCount = screen.listIdeas.filter((idea) => isIdeaEffectivelyHidden(idea)).length;

  const hiddenDayGroupsInView = screen.activeTimelineMetric
    ? Array.from(
        new Map(
          screen.listIdeas
            .map((idea) => {
              const bucket = getDateBucket(getIdeaSortTimestamp(idea, store.ideasSort));
              const key = `${screen.activeTimelineMetric}:${bucket.startTs}`;
              return screen.hiddenDayKeySet.has(key)
                ? [key, { metric: screen.activeTimelineMetric, dayStartTs: bucket.startTs }] as const
                : null;
            })
            .filter(Boolean) as Array<readonly [string, { metric: "created" | "updated"; dayStartTs: number }]>
        ).values()
      )
    : [];
  const hiddenIdeaIdsInView = screen.listIdeas
    .filter((idea) => screen.hiddenIdeaIdsSet.has(idea.id))
    .map((idea) => idea.id);

  const unhideAllInCurrentView = () => {
    if (!screen.collectionId) return;
    if (hiddenIdeaIdsInView.length > 0) {
      store.setIdeasHidden(screen.collectionId, hiddenIdeaIdsInView, false);
    }
    if (hiddenDayGroupsInView.length > 0) {
      store.setTimelineDaysHidden(screen.collectionId, hiddenDayGroupsInView, false);
    }
    screen.setHeaderMenuOpen(false);
  };

  return (
    <>
      <IdeaListFilterSection
        selectedProjectStages={screen.selectedProjectStages}
        lyricsFilterMode={screen.lyricsFilterMode}
        showDateDividers={screen.showDateDividers}
        stickyDayLabel={screen.stickyDayLabel}
        stickyDayTop={screen.stickyDayTop}
        hiddenItemsCount={hiddenItemsCount}
        onLayout={(nextTop) =>
          screen.setStickyDayTop((prev) => (Math.abs(prev - nextTop) < 1 ? prev : nextTop))
        }
        onToggleProjectStage={(stage) => {
          screen.setSelectedProjectStages((prev) =>
            prev.includes(stage) ? prev.filter((item) => item !== stage) : [...prev, stage]
          );
        }}
        onClearProjectStages={() => screen.setSelectedProjectStages([])}
        onLyricsFilterModeChange={screen.setLyricsFilterMode}
        onUnhideAll={unhideAllInCurrentView}
      />
      <IdeaListNestedCollectionsSection
        childCollections={screen.childCollections}
        expanded={screen.nestedCollectionsExpanded}
        onToggleExpanded={() => screen.setNestedCollectionsExpanded((prev) => !prev)}
        onOpenCollection={(nextCollectionId) =>
          openCollectionInBrowse(screen.navigation, {
            collectionId: nextCollectionId,
            ...screen.collectionRouteParams,
          })
        }
        onOpenCollectionActions={management.openCollectionActions}
      />
    </>
  );
}
