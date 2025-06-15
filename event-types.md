## Primary Event Types (Directly Generated)

### Navigation Events
1. **navigation_committed** – When a navigation starts (includes URL, tab ID, transition type, search query if detected)  
2. **navigation_completed** – When a navigation finishes (includes URL, tab ID)

### Tab Management Events
3. **tab_activated** – When a tab becomes active (includes tab ID, URL)  
4. **tab_updated** – When tab properties change (includes tab ID, URL, change info)  
5. **tab_removed** – When a tab is closed (includes tab ID, remove info)

### Download Events
6. **download_created** – When a download starts (includes filename, URL, MIME type)  
7. **download_changed** – When download status changes (includes download delta)  
8. **download_erased** – When a download is removed from history (includes download ID)

### Content Events
9. **selection** – When text is selected on a page (includes tab ID, selected text up to 1KB)  
10. **copy** – When text is copied to clipboard (includes tab ID, copied text up to 1KB)  
11. **readability** – When page content is parsed by Readability library (includes title, byline, excerpt, word count, hash)

### Lifecycle & Monitoring Events
12. **heartbeat** – Regular heartbeat every 15 seconds for focused tabs (includes tab ID, seconds visible)  
13. **extension_startup** – When service worker starts up  
14. **extension_installed** – When extension is installed or updated (includes installation details)

### Communication Events
15. **message_received** – All inter-component messages (includes message content, sender info)  
16. **connection** – When event stream pages connect/disconnect (includes action, port ID)

### Error Events
17. **error** – Comprehensive error logging from all components (includes error message, details, source, stack trace)

---

## Secondary Event Types (Via `message_received`)

These are messages sent by content scripts that get logged as `message_received` events but don't have dedicated handlers:

18. **visibility_change** – Page visibility state changes  
19. **window_focus** – Window focus/blur events  
20. **content_script_loaded** – Content script initialization  
21. **content_script_error** – Errors in content scripts

---

## Special Cases

- **Multiple logging** – Some user actions generate multiple log entries (e.g., copying text creates both a `message_received` and a `copy` event)  
- **Error context** – Every event handler has try-catch blocks, so any failure generates additional `error` events  
- **Service worker errors** – Global error handlers capture unhandled errors and promise rejections  
- **Parse messages** – HTML content sent for parsing gets logged as `message_received` but only generates `readability` events if parsing succeeds