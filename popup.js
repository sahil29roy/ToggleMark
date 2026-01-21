document.addEventListener('DOMContentLoaded', async () => {
  const reminderTimeSelect = document.getElementById('reminder-time');
  const setReminderBtn = document.getElementById('set-reminder-btn');
  const statusMessageDiv = document.getElementById('status-message');

  // Get current tab information
  const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });

  setReminderBtn.addEventListener('click', async () => {
    const selectedMinutes = parseInt(reminderTimeSelect.value);
    
    if (isNaN(selectedMinutes) || selectedMinutes <= 0) {
      showMessage('Please select a valid reminder time.', 'error');
      return;
    }

    if (!currentTab.url) {
      showMessage('Cannot set reminder for this page.', 'error');
      return;
    }

    try {
      // First, ensure the page is bookmarked
      const bookmarks = await browser.bookmarks.search({ url: currentTab.url });
      
      if (bookmarks.length === 0) {
        // Create bookmark if it doesn't exist
        const result = await browser.storage.local.get(['quickSavesFolderId']);
        const folderId = result.quickSavesFolderId;

        await browser.bookmarks.create({
          title: currentTab.title,
          url: currentTab.url,
          parentId: folderId || undefined
        });
        
        showMessage('Page bookmarked and reminder set!', 'success');
      } else {
        showMessage('Reminder set for bookmarked page!', 'success');
      }

      // Find the bookmark ID
      const bookmark = bookmarks.length > 0 ? bookmarks[0] : null;
      const bookmarkId = bookmark ? bookmark.id : null;

      // Send message to background script to set the reminder
      await browser.runtime.sendMessage({
        action: 'setReminder',
        bookmarkId: bookmarkId,
        url: currentTab.url,
        title: currentTab.title,
        minutes: selectedMinutes
      });

    } catch (error) {
      console.error('Error setting reminder:', error);
      showMessage(`Error setting reminder: ${error.message}`, 'error');
    }
  });

  function showMessage(message, type) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `status ${type}`;
    statusMessageDiv.style.display = 'block';
    
    setTimeout(() => {
      statusMessageDiv.style.display = 'none';
    }, 3000);
  }
});