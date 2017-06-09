

import { updateRecentFileButton } from "./index";

export class LocalStorageManager {

    static recentFiles = [];
    static visibleColumns = [];

    static setupLocalStorage() {
        //load the recent file list from localStorage
        LocalStorageManager.recentFiles = JSON.parse(localStorage.getItem("recentFiles"));
        if (LocalStorageManager.recentFiles === null) {
            LocalStorageManager.recentFiles = [];
        }
        updateRecentFileButton();

        LocalStorageManager.visibleColumns = JSON.parse(localStorage.getItem("visibleColumns"));
        if (LocalStorageManager.visibleColumns === null) {
            LocalStorageManager.visibleColumns = ["description"];
        }
    };
}