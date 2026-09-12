import { toPng } from 'html-to-image';
import type { RecapStoryCaptureAdapter } from './recapStoryCapture.types';
import { STORY_LOGICAL_HEIGHT, STORY_LOGICAL_WIDTH } from './recapStoryTheme';

export const recapStoryCaptureAdapter: RecapStoryCaptureAdapter<HTMLElement> = {
  capture(node) {
    return toPng(node, {
      width: STORY_LOGICAL_WIDTH,
      height: STORY_LOGICAL_HEIGHT,
      pixelRatio: 3,
      cacheBust: false,
    });
  },

  async canShare() {
    return false;
  },

  async share(uri) {
    await this.download(uri, 'pip-monthly-story.png');
  },

  async download(uri, filename) {
    const anchor = document.createElement('a');
    anchor.href = uri;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  },

  async requestSavePermission() {
    return 'denied';
  },

  async save(_uri) {
    throw new Error('Saving stories to Photos is unavailable on web');
  },

  async cleanup(_uri) {
    // Web captures are data URLs rather than temporary files.
  },

  async openInstagram() {
    return false;
  },
};

export default recapStoryCaptureAdapter;
