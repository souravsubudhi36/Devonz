import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { getPreviewErrorHandler } from '~/utils/previewErrorHandler';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('WebContainer');

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        return WebContainer.boot({
          coep: 'credentialless',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        webcontainerContext.loaded = true;

        const response = await fetch('/inspector-script.js');
        const inspectorScript = await response.text();
        await webcontainer.setPreviewScript(inspectorScript);

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          logger.debug('WebContainer preview message:', message);

          // Use the preview error handler for cooldown and deduplication
          getPreviewErrorHandler().handlePreviewMessage(
            message as {
              type: string;
              message?: string;
              stack?: string;
              pathname?: string;
              search?: string;
              hash?: string;
              port?: number;
            },
          );
        });

        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
