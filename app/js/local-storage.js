/* globals recentFiles, visibleColumns, updateRecentFileButton */

module.exports = function setupLocalStorage() {
    //load the recentfile list from localStorage
    recentFiles = JSON.parse(localStorage.getItem("recentFiles"));
    if (recentFiles === null) {
        recentFiles = [];
    }
    updateRecentFileButton();

    visibleColumns = JSON.parse(localStorage.getItem("visibleColumns"));
    if (visibleColumns === null) {
        visibleColumns = ["description"];
    }
};