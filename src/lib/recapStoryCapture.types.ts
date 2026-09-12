import type { RecapStoryScene } from './recapStory';

export type RecapStorySceneId = RecapStoryScene['id'];
export type RenderAndCaptureStory = (sceneId: RecapStorySceneId) => Promise<string>;

export interface RecapStoryCaptureAdapter<Ref> {
  capture(ref: Ref): Promise<string>;
  canShare(): Promise<boolean>;
  share(uri: string): Promise<void>;
  download(uri: string, filename: string): Promise<void>;
  requestSavePermission(): Promise<'granted' | 'denied'>;
  save(uri: string): Promise<void>;
  cleanup(uri: string): Promise<void>;
  openInstagram(): Promise<boolean>;
}

export type SaveStoryResult = {
  savedIds: RecapStorySceneId[];
  failedIds: RecapStorySceneId[];
};

export type SavePermissionDeniedResult = {
  status: 'permission-denied';
};

export type SaveSelectedStoriesResult = SaveStoryResult | SavePermissionDeniedResult;
