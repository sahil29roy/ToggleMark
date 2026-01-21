/**
 * ToggleMark - Core Logic
 * Handles state detection, toggling, and UI updates.
 */

const QUICK_SAVES_FOLDER_NAME = "⚡ Quick Saves";

const STATE = {
    BOOKMARKED: {
        icon: "icons/bookmarked.svg",
        title: "Remove Bookmark"
    },
    UNBOOKMARKED: {
        icon: "icons/unbookmarked.svg",
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
            
            // Also remove from expiring bookmarks storage
            const existingBookmarks = await browser.storage.local.get(['expiringBookmarks']);
            const expiringBookmarks = existingBookmarks.expiringBookmarks || {};
            
            // Remove the bookmark IDs that were just deleted
            for (const bookmark of bookmarks) {
                if (expiringBookmarks[bookmark.id]) {
                    delete expiringBookmarks[bookmark.id];
                }
            }
            
            await browser.storage.local.set({ expiringBookmarks });
        } else {
            // Get the Quick Saves folder ID from storage
            const result = await browser.storage.local.get(['quickSavesFolderId']);
            let folderId = result.quickSavesFolderId;
            
            // If folder ID is not in storage, try to find the folder
            if (!folderId) {
                await setupQuickSavesFolder();
                const updatedResult = await browser.storage.local.get(['quickSavesFolderId']);
                folderId = updatedResult.quickSavesFolderId;
            }
            
            // Create new bookmark in the Quick Saves folder
            const bookmark = await browser.bookmarks.create({
                title: tab.title,
                url: tab.url,
                parentId: folderId || undefined  // Use default location if folder not found
            });
            
            // Store the bookmark ID and timestamp for expiration
            const now = Date.now();
            const EXPIRATION_DAYS = 7; // Configurable: 7 days
            const expirationTime = now + (EXPIRATION_DAYS * 24 * 60 * 60 * 1000); // 7 days in milliseconds
            
            // Get existing expiring bookmarks and add the new one
            const existingBookmarks = await browser.storage.local.get(['expiringBookmarks']);
            const expiringBookmarks = existingBookmarks.expiringBookmarks || {};
            expiringBookmarks[bookmark.id] = {
                url: tab.url,
                createdAt: now,
                expiresAt: expirationTime
            };
            
            await browser.storage.local.set({ expiringBookmarks });
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

// --- Startup Logic ---

// Create dedicated folder for quick saves on startup
browser.runtime.onInstalled.addListener(setupQuickSavesFolderAndAlarms);

async function setupQuickSavesFolderAndAlarms() {
    await setupQuickSavesFolder();
    await setupCleanupAlarm();
}

async function setupQuickSavesFolder() {
    try {
        // Search for existing "Quick Saves" folder
        const folders = await browser.bookmarks.search({ title: QUICK_SAVES_FOLDER_NAME });
        
        let quickSavesFolder = folders.find(folder => folder.type === 'folder');
        
        if (!quickSavesFolder) {
            // Create the folder if it doesn't exist
            // Try to place it in the bookmarks toolbar first, otherwise in Other Bookmarks
            const bookmarkBars = await browser.bookmarks.search({ title: 'Bookmarks Toolbar' });
            const bookmarkBar = bookmarkBars.find(bar => bar.type === 'folder');
            
            const parentId = bookmarkBar ? bookmarkBar.id : undefined;
            
            quickSavesFolder = await browser.bookmarks.create({
                title: QUICK_SAVES_FOLDER_NAME,
                type: 'folder',
                parentId: parentId
            });
        }
        
        // Store the folder ID for future use
        await browser.storage.local.set({ quickSavesFolderId: quickSavesFolder.id });
    } catch (error) {
        console.error(`Error setting up Quick Saves folder: ${error}`);
    }
}

async function setupCleanupAlarm() {
    try {
        // Create an alarm that runs once a day (1440 minutes = 24 hours)
        await browser.alarms.create('cleanup_expired_bookmarks', {
            periodInMinutes: 1440  // Once per day
        });
        
        // Add listener for the alarm
        browser.alarms.onAlarm.addListener(handleCleanupAlarm);
    } catch (error) {
        console.error(`Error setting up cleanup alarm: ${error}`);
    }
}

async function handleCleanupAlarm(alarm) {
    if (alarm.name === 'cleanup_expired_bookmarks') {
        await cleanupExpiredBookmarks();
    }
}

async function cleanupExpiredBookmarks() {
    try {
        const now = Date.now();
        const result = await browser.storage.local.get(['expiringBookmarks']);
        const expiringBookmarks = result.expiringBookmarks || {};
        
        const expiredBookmarkIds = [];
        
        // Find expired bookmarks
        for (const [id, bookmarkData] of Object.entries(expiringBookmarks)) {
            if (now >= bookmarkData.expiresAt) {
                expiredBookmarkIds.push(id);
            }
        }
        
        // Remove expired bookmarks
        for (const id of expiredBookmarkIds) {
            try {
                await browser.bookmarks.remove(id);
                // Remove from storage as well
                delete expiringBookmarks[id];
            } catch (error) {
                // Bookmark might have been manually removed, just continue
                delete expiringBookmarks[id];
            }
        }
        
        // Update storage with remaining bookmarks
        await browser.storage.local.set({ expiringBookmarks });
    } catch (error) {
        console.error(`Error during cleanup of expired bookmarks: ${error}`);
    }
}

// --- Reminder Functionality ---

// Set a reminder for a bookmark
async function setReminder(bookmarkId, bookmarkUrl, bookmarkTitle, minutes) {
    try {
        const now = Date.now();
        const reminderTime = now + (minutes * 60 * 1000); // Convert minutes to milliseconds
        
        // Get existing reminders and add the new one
        const existingReminders = await browser.storage.local.get(['reminders']);
        const reminders = existingReminders.reminders || {};
        
        reminders[bookmarkId] = {
            url: bookmarkUrl,
            title: bookmarkTitle,
            setTime: now,
            reminderTime: reminderTime,
            minutes: minutes
        };
        
        await browser.storage.local.set({ reminders });
        
        // Create a one-time alarm for this reminder
        await browser.alarms.clear(`reminder_${bookmarkId}`);
        await browser.alarms.create(`reminder_${bookmarkId}`, {
            when: reminderTime
        });
        
        console.log(`Reminder set for bookmark ${bookmarkId} for ${minutes} minutes`);
    } catch (error) {
        console.error(`Error setting reminder: ${error}`);
    }
}

// Handle reminder alarm
async function handleReminderAlarm(alarm) {
    if (alarm.name.startsWith('reminder_')) {
        const bookmarkId = alarm.name.replace('reminder_', '');
        await triggerReminder(bookmarkId);
    }
}

// Trigger the reminder notification and audio
async function triggerReminder(bookmarkId) {
    try {
        const result = await browser.storage.local.get(['reminders']);
        const reminders = result.reminders || {};
        
        const reminder = reminders[bookmarkId];
        if (reminder) {
            // Show notification
            const notificationId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await browser.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icons/bookmarked.svg',
                title: 'Bookmark Reminder',
                message: `Time to review: ${reminder.title}`
            });
            
            // Play audio alert
            playAudioAlert();
            
            // Open the bookmarked page
            await browser.tabs.create({ url: reminder.url });
            
            // Remove the reminder after triggering
            delete reminders[bookmarkId];
            await browser.storage.local.set({ reminders });
            
            console.log(`Reminder triggered for bookmark ${bookmarkId}: ${reminder.title}`);
        }
    } catch (error) {
        console.error(`Error triggering reminder: ${error}`);
    }
}

// Play audio alert using Web Audio API
function playAudioAlert() {
    try {
        // Create audio context and play a beep sound
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800; // 800 Hz tone
        gainNode.gain.value = 0.3; // Volume (0.0 to 1.0)
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, 500); // Beep for 500ms
    } catch (error) {
        console.error(`Error playing audio alert: ${error}`);
        
        // Fallback: try to play a system beep if possible
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 100, 100]);
        }
    }
}

// Listen for reminder alarms
browser.alarms.onAlarm.addListener(handleReminderAlarm);

// Listen for messages from popup
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'setReminder') {
    // If we don't have a bookmark ID, search for it by URL
    let { bookmarkId, url, title, minutes } = message;
    
    if (!bookmarkId) {
      const bookmarks = await browser.bookmarks.search({ url: url });
      if (bookmarks.length > 0) {
        bookmarkId = bookmarks[0].id;
      }
    }
    
    if (bookmarkId) {
      await setReminder(bookmarkId, url, title, minutes);
      return Promise.resolve({ success: true, message: `Reminder set for ${minutes} minutes` });
    } else {
      return Promise.resolve({ success: false, message: 'Could not find or create bookmark for this URL' });
    }
  }
});
