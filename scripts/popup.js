document.getElementById("saveBtn").addEventListener("click", async () => {
    const folderName = document.getElementById("folderInput").value.trim();
    if (!folderName) {
        alert("請輸入資料夾名稱");
        return;
    }

    // 取得目前分頁的 URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pageUrl = new URL(tab.url);
    const domain = pageUrl.hostname;
    console.log("目前分頁 URL:", domain);

    if (!domain) {
        console.log("缺少網址！");
        return;
    }

    /** data is json format
     * {
     *      folderMappings:{
     *          domain: folderName
     *      }
     * }
     */
    // if folderMappings is defined then return current folderMapping object 
    // else return empty folderMapping object.
    const data = await storageGet({ folderMappings: {} }); 
    const folderMappings = data.folderMappings;
    folderMappings[domain] = folderName;
    await storageSet({ folderMappings });
    document.getElementById("folderInput").value = ""; // 清空輸入框

});

document.getElementById("clearBtn").addEventListener("click", async () => {
    const data = await storageGet({ folderMappings: {} });
    const folderMappings = data.folderMappings;
    if (folderMappings) {
        await storageSet({ folderMappings: {} });
        console.log("已清除所有資料夾對應關係");
    }
});
