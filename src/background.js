import { Storage, communicator, isEmpty } from './util';

const snapshotList = new Storage({
  namespace: 'SNAPSHOT_NAME_LIST',
});

communicator.onMessageForBG = async ({ action, data }, sender) => {
  const { tab } = sender;

  const actionMap = {
    /**
     * will be triggered by content script
     */
    async SAVE() {
      const { url: tabUrl } = tab;
      const { hostname: tabHost } = new URL(tabUrl);

      const store = new Storage({ namespace: tabHost });
      let originData = await store.get(tabUrl);

      if (isEmpty(originData)) {
        originData = {
          actions: [],
          url: tabUrl,
          host: tabHost,
        };
      }

      originData.actions.push(data);

      store.set({
        [tabUrl]: originData,
      });
    },
    /**
     * will be triggered by popup
     */
    async CREATE_SNAPSHOT({ host, url }) {
      /**
       * [warn] this may cause issues when multiple snapshot
       * is created at the same time.
       */
      const store = new Storage({ namespace: host });
      const originList = (await snapshotList.get('all')) || [];
      const frame = await store.get(url);
      const snapshotName = `snapshot-${originList.length + 1}`;
      const snapshotStore = new Storage({ namespace: snapshotName });
      snapshotList.set({
        all: [...originList, snapshotName],
      });
      snapshotStore.set(frame);
    },
    /**
     * when extension is available
     * 
     * triggered by content script
      */
    AVAILABLE() {
      chrome.browserAction.setIcon({
        tabId: tab.id,
        path: {
          32: 'img/bot_32.png',
          64: 'img/bot_64.png',
        },
      });
      chrome.browserAction.setPopup({
        tabId: tab.id,
        popup: 'popup.html',
      });
    },
  };

  const handler = actionMap[action];
  handler ? handler(data) : null;
};
