importScripts('storageMapping.js');

function cancelDownload(downloadId) {
    const promise = new Promise((resolve, reject) => {
        chrome.downloads.cancel(downloadId, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
    return promise;
}

function eraseInterruptedDownload(downloadId) {
    const promise = new Promise((resolve, reject) => {
        chrome.downloads.erase({ id: downloadId }, (erasedIds) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            if (erasedIds && erasedIds.length > 0) {
                console.log("下載記錄已刪除：", erasedIds);
                resolve(erasedIds);
            } else {
                console.log("找不到下載記錄或刪除失敗");
                reject(new Error("找不到下載記錄或刪除失敗"));
            }
        });
    });
    return promise;
}

function startDownload(url, filename) {
    const promise = new Promise((resolve, reject) => {
        chrome.downloads.download({ url, filename }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
    return promise;
}

function getStorageUrl(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                console.log(`getStorageUrl 已取得 ${key}:`, result[key]);
                resolve(result);
            }
        });
    });
}

function setStorageUrl(key, url) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: url }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                console.log(`setStorageUrl 已儲存 ${key}: ${url}`);
                resolve();
            }
        });
    });
}

async function queryCurrentWebURL() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let domain = "";
    if (tab.url === undefined || tab.url === null || tab.url === "") {
        console.log("目前分頁 pendingUrl:", tab.pendingUrl);
        const pageUrl = new URL(tab.pendingUrl);
        domain = pageUrl.hostname;
    } else {
        console.log("目前分頁 URL:", tab.url);
        const pageUrl = new URL(tab.url);
        domain = pageUrl.hostname;
    }
    console.log("domain:", domain);
    return domain;
}

async function handleDownloadCreated(downloadItem) {

    let url = downloadItem.url;
    const result = await getStorageUrl("url");
    console.log(result.url);
    if (result.url === url) {
        return;
    } else {
        await storageSet({ flag: { flag: false } });
        await setStorageUrl("url", url);
        try {

            const domain = await queryCurrentWebURL();
            const data = await storageGet({ folderMappings: {} });
            const folderMappings = data.folderMappings;

            if (folderMappings[domain]) {

                console.log(`取消原下載: ${downloadItem.id}`);
                await cancelDownload(downloadItem.id);
                await eraseInterruptedDownload(downloadItem.id);
                await storageSet({ reload: { downloadUrl: url, storageFilePath: folderMappings[domain] } });
                await storageSet({ flag: { flag: true } });
            }
        } catch (err) {
            await storageSet({ flag: { flag: true } });
            console.error('錯誤:', err.message);
            chrome.storage.local.remove(["url", "filename"], () => {
                console.log("已移除 url");
            });
        }
    }
}

chrome.downloads.onCreated.addListener(handleDownloadCreated);
chrome.downloads.onChanged.addListener(async (delta) => {
    while (true) {
        const data = await storageGet({ flag: {} });
        const flag = data.flag;
        if (flag.flag) {
            console.log("flag is true, continue");
            break;
        }
    }
    console.log("state: ", delta.state);
    console.log("filename: ", delta.filename);
    if (delta.filename) {
        //console.log("Filename updated:", delta.filename.current);
        const urlStr = delta.filename.current;
        const fileName = urlStr.split("\\").pop();
        //console.log("Filename:", fileName);
        await setStorageUrl("filename", fileName);
    }
    if (delta.state && delta.state.current === "interrupted") {
        const data = await storageGet({ reload: {} });
        const filename = await getStorageUrl("filename");
        const { downloadUrl: url, storageFilePath: folderPath } = data.reload;
        console.log(`重新下載: ${url}`);
        console.log("reload filename : ", filename.filename);
        console.log("storageFilePath : ", folderPath);
        await startDownload(url, `${folderPath}/${filename.filename}`);
    }
});
chrome.downloads.onChanged.addListener(async (delta) => {
    if (delta.state && delta.state.current === "complete") {
        await storageSet({ flag: { flag: true } });
        chrome.storage.local.remove(["url", "filename"], () => {
            console.log("已移除 url");
        });
    }
});