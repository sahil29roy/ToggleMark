/**
 * ToggleMark - Core Logic
 * Handles state detection, toggling, and UI updates.
 */

const STATE = {
    BOOKMARKED: {
        icon: "icons/bookmarked.png",
        title: "Remove Bookmark"
    },
    UNBOOKMARKED: {
        icon: "icons/unbookmarked.png",
        title: "Add Bookmark"
    }
};

/**
 * Checks if a URL is bookmarked and updates the toolbar button UI.
 */
async function updateUI(tabId, url) {
    if (!url || url.startsWith('about:') || url.startsWith('chrome:')) {
        return;
    }

    try {
        const bookmarks = await browser.bookmarks.search({ url });
        const isBookmarked = bookmarks.length > 0;
        const { icon, title } = isBookmarked ? STATE.BOOKMARKED : STATE.UNBOOKMARKED;

        await Promise.all([
            browser.browserAction.setIcon({ tabId, path: icon }),
            browser.browserAction.setTitle({ tabId, title })
        ]);
    } catch (error) {
        console.error(`Error updating UI: ${error}`);
    }
}

/**
 * Toggles the bookmark state for the current tab.
 */
async function toggleBookmark(tab) {
    if (!tab.url) return;

    try {
        const bookmarks = await browser.bookmarks.search({ url: tab.url });

        if (bookmarks.length > 0) {
            // Remove all bookmarks found for this URL
            await Promise.all(bookmarks.map(bm => browser.bookmarks.remove(bm.id)));
        } else {
            // Create new bookmark in 'Other Bookmarks' (default)
            await browser.bookmarks.create({
                title: tab.title,
                url: tab.url
            });
        }

        // Refresh UI after change
        await updateUI(tab.id, tab.url);
    } catch (error) {
        console.error(`Error toggling bookmark: ${error}`);
    }
}

// --- Event Listeners ---

// 1. Handle Toolbar Click
browser.browserAction.onClicked.addListener((tab) => {
    toggleBookmark(tab);
});

// 2. Handle Tab Switching
browser.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await browser.tabs.get(activeInfo.tabId);
    updateUI(tab.id, tab.url);
});

// 3. Handle Page Load/URL Change
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        updateUI(tabId, tab.url);
    }
});

// 4. Handle External Bookmark Changes (Manual deletion/addition)
browser.bookmarks.onCreated.addListener(async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) updateUI(tab.id, tab.url);
});

browser.bookmarks.onRemoved.addListener(async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) updateUI(tab.id, tab.url);
});
