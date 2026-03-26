export type ShareImportScreenProps = {
  fallbackCollectionId: string | null;
};

export type CollectionDestination = {
  workspaceId: string;
  collectionId: string;
  workspaceTitle: string;
  collectionTitle: string;
  pathLabel: string;
};
