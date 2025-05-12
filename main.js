// main.js

import { initSidePanel } from './SDPNL/sidePanel.js';
import { initEditArea } from './LEDR/editArea.js';
import { initSlashCommand } from './SCMD/slashCommand.js';
import { initHomepage } from './homePage.js'; 
import { initTextStyleModal } from './LEDR/textStyleModal.js';
import { initTableEditor } from './LEDR/tableEditor.js';
import { initEmojiModal } from './SCMD/emojiModal.js';
import { initEmbedPageModal } from './SCMD/embedPageModal.js';
import { initAuth } from './auth_client.js';
import { initUserSettingsModal } from './userSettingsModal.js';
import { initMoreOptionsModal } from './moreOptionsModal.js';
import { initPagePeekModalSystem } from './LEDR/pagePeekModal.js';

document.addEventListener('DOMContentLoaded', () => {
   const appContext = {
       // Auth State
       currentUser: null,
       userSettings: { theme: 'dark' }, // *** Add default user settings ***
       
       // App State for the MAIN EDITOR
       currentProject: null,
       currentPageState: null, // { id, title, originalMarkdown, versionHash, type?: 'announcement' | 'project' }
       hasUnsavedChanges: false,
       isSaving: false, 
       autosaveTimeoutId: null, 

       // View & Context Management
       currentView: 'home', // 'home' | 'projects' | 'project_detail' | 'announcements_list' | 'announcement_detail' | 'login'
       currentAnnouncementContext: null, // { id, name } when in 'announcement_detail' (editor context)

       slashCommandInfo: null,
       isSlashCommandActive: false,
       autosaveDelay: 3000, 

       // DOM Elements
       announcementsSectionHeader: document.getElementById('announcements-section-header'),
       announcementsContentArea: document.getElementById('announcements-content-area'),
       projectsSectionHeader: document.getElementById('projects-section-header'),
       projectsContentArea: document.getElementById('pageTreeContainer'),

       sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'), // Add button reference

       userProfileAreaContainer: document.getElementById('user-profile-area-container'),
       liveEditor: document.getElementById('live-editor'), 
       savePageBtn: document.getElementById('save-page-btn'), 
       currentPageDisplay: document.getElementById('current-page-display'), 
       statusMessage: document.getElementById('status-message'), 

       // Common Modals / UI elements
       slashCommandModal: document.getElementById('slash-command-modal'),
       actionsModal: document.getElementById('actions-modal'),
       textStyleModal: document.getElementById('text-style-modal'),
       userSettingsModal: null, 
       moreOptionsModal: null,
       emojiModal: null,
       emojiListContainer: null,
       embedPageModal: null,
       embedPageTreeContainer: null,

       // Page Peek Modal System
       activePeekModals: [], 
       openPageInPeekMode: null, 
       removePeekModal: null,    
       closeAllPeekModals: null, 
       getTopPeekModal: null,    
       handlePeekModalLayoutChange: null, 


       // Core functions
       showStatus: null,
       applyTheme: null, // *** Add applyTheme function placeholder ***
       displayHomepage: null,
       clearHomepage: null,   
       updateSaveButtonState: null, 
       clearEditor: null, 
       loadPageContent: null, // For user project pages
       savePage: null,
       scheduleAutosave: null,
       performAutosave: null,
       
       // Global utility functions
       htmlToMarkdown: null, 
       fetchWithAuth: null, 
       clientConverter: null, 
       DmpInstance: null, 

       // Side panel functions
       fetchProjects: null, // (isProjectLoad: boolean) => void
       fetchPageTree: null, // For user projects
       createNewProject: null,
       clearSidebarActiveStates: null, // From sidePanel

       // Announcement related functions (from sidePanel.js then sideAnnouncement.js)
       fetchAnnouncementsList: null, // New: Fetches and renders the list of announcements
       // switchToAnnouncementsListView: null, // This role is partly taken by fetchAnnouncementsList or direct section rendering
       selectAnnouncementHandler: null, // Handles clicking an announcement in the list
       fetchAnnouncementPageTree: null, // Fetches page tree for a selected announcement
       loadAnnouncementPageContent: null, // Loads announcement page into editor
       
       // Other modal/action handlers
       openActionsModal: null,
       openUserSettingsModal: null,
       closeUserSettingsModal: null,
       openEmbedPageModal: null,
       openEmojiModal: null,
       closeEmojiModal: null,
       closeMoreOptionsModal: null,
       closeEmbedPageModal: null,
       removeSlashCommandTextFromEditor: null,
       closeSlashCommandModal: null,

       slashCommandInstance: null, 
       // Auth functions
       checkAuthStatus: null,
       showLoginScreen: null,
       logoutUser: null,
       renderUserProfile: null,

       // Action handlers (project/page management)
       deleteProject: null,
       renameProject: null,
       duplicateProject: null,
       deletePage: null,
       renamePage: null,
       duplicatePage: null,
       renderCoreSidebarElements: null, // Add this for clarity, will be populated by sidePanel.js
   };

    appContext.fetchWithAuth = async (url, options = {}) => {
        const token = localStorage.getItem('authToken');
        options.headers = {
            ...options.headers,
        };
        if (options.body && !options.headers['Content-Type']) {
             options.headers['Content-Type'] = 'application/json';
        }

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, options);

        if (response.status === 401 || response.status === 403) {
            console.warn(`Authentication error (${response.status}) for ${url}. Clearing token and logging out.`);
            await appContext.logoutUser(); // Call logout which handles UI cleanup and redirects
            const errorData = await response.json().catch(() => ({ error: `Auth Error: ${response.status}` }));
            throw new Error(errorData.error || `Auth Error: ${response.status}`);
        }
        return response;
    };


   // ... showStatus function ... (keep as is)
    appContext.showStatus = (message, type = 'info', duration = 3000) => {
       if (!appContext.statusMessage) return;
       appContext.statusMessage.textContent = message;
       appContext.statusMessage.className = type;

       if (appContext.statusMessage._timeoutId) {
           clearTimeout(appContext.statusMessage._timeoutId);
           appContext.statusMessage._timeoutId = null;
       }

       if (duration > 0) {
           appContext.statusMessage._timeoutId = setTimeout(() => {
               if (appContext.statusMessage.textContent === message) {
                   appContext.statusMessage.textContent = '';
                   appContext.statusMessage.className = '';
               }
               appContext.statusMessage._timeoutId = null;
           }, duration);
       }
   };

    let turndownServiceInstance;
    if (typeof TurndownService === 'function') {
        turndownServiceInstance = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
        turndownServiceInstance.addRule('pWithOnlyBrToHTML', {
            filter: function (node) { return node.nodeName === 'P' && node.childNodes.length === 1 && node.firstChild.nodeName === 'BR'; },
            replacement: function () { return '<p><br></p>\n\n'; }
        });
        turndownServiceInstance.addRule('emptyPToHTMLPWithBr', {
            filter: function (node) { return node.nodeName === 'P' && node.innerHTML.trim() === ''; },
            replacement: function () { return '<p><br></p>\n\n'; }
        });
        turndownServiceInstance.addRule('strikethrough', {
            filter: ['del', 's', 'strike'],
            replacement: function (content) { return '~~' + content + '~~'; }
        });
        turndownServiceInstance.addRule('taskListItems', {
            filter: function (node) { return node.nodeName === 'LI' && node.firstChild && node.firstChild.nodeName === 'INPUT' && node.firstChild.getAttribute('type') === 'checkbox'; },
            replacement: function (content, node) {
                const checkbox = node.firstChild;
                const isChecked = checkbox.checked;
                const newContent = content.replace(/^\s+/, ''); 
                const parentList = node.parentNode;
                let listItemPrefix = (parentList && parentList.nodeName === 'OL' ? (Array.from(parentList.children).indexOf(node) + 1) + '. ' : (turndownServiceInstance.options.bulletListMarker || '*') + ' ');
                return listItemPrefix + (isChecked ? '[x] ' : '[ ] ') + newContent;
            }
        });
        turndownServiceInstance.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption']);

        // Keep Font Awesome <i> tags with 'fas' class
        turndownServiceInstance.keep(function (node) {
            return node.nodeName === 'i' && node.classList && node.classList.contains('fas');
        });

        appContext.htmlToMarkdown = (htmlString) => {
            if (!turndownServiceInstance) { return htmlString; }
            try {
                let cleanedHtml = htmlString.replace(/\u00A0/g, ' '); 
                let markdown = turndownServiceInstance.turndown(cleanedHtml);
                markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
                if (markdown) markdown += '\n'; 
                return markdown;
            } catch (error) {
                console.error("Turndown error:", error);
                return `<!-- Turndown Error: ${error.message} -->\n${htmlString}`; 
            }
        };
    } else {
        console.error("TurndownService library not found.");
        appContext.htmlToMarkdown = (htmlString) => { return htmlString; }; 
    }

    appContext.clientConverter = new showdown.Converter();
    appContext.clientConverter.setOption('tables', true);
    appContext.clientConverter.setOption('tasklists', true);
    appContext.clientConverter.setOption('strikethrough', true);
    
    if (typeof diff_match_patch === 'function') {
        appContext.DmpInstance = new diff_match_patch();
    } else {
        appContext.DmpInstance = null;
        console.warn("diff_match_patch library not loaded globally. Differential saving disabled for main editor if not provided by context.");
    }
    // *** NEW: applyTheme function ***
    appContext.applyTheme = (theme) => {
        console.log(`Applying theme: ${theme}`);
        const body = document.body;
        body.classList.remove('theme-light', 'theme-dark'); // Remove existing theme classes

        if (theme === 'dark') {
            body.classList.add('theme-dark');
        } else {
            body.classList.add('theme-light'); // Default to light
        }

        // Ensure the setting is stored in the context
        if (appContext.userSettings) {
            appContext.userSettings.theme = theme;
        } else {
            appContext.userSettings = { theme: theme }; // Initialize if missing
        }
         // Persist preference locally for faster loading next time (optional but good UX)
         localStorage.setItem('preferredTheme', theme);
    };

   // *** Updated logoutUser function ***
    appContext.logoutUser = async () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                 // No need to await logout if we immediately clear client state
                 appContext.fetchWithAuth('/api/auth/logout', { method: 'POST' })
                    .catch(err => console.warn("Server logout call failed, proceeding with client logout:", err.message));
            } catch (error) {
                 // Error during fetchWithAuth itself (like network error)
                console.warn("Error calling server logout endpoint:", error.message);
            }
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('preferredTheme'); // Clear theme pref on logout
        appContext.currentUser = null;
        appContext.userSettings = { theme: 'dark' }; // Reset settings to default
        appContext.currentProject = null;
        appContext.currentPageState = null;
        appContext.hasUnsavedChanges = false;
        appContext.currentView = 'login';
        appContext.currentAnnouncementContext = null;

        // Apply default theme on logout
        appContext.applyTheme('dark'); // Apply default dark theme

        // Clear UI elements
        if (appContext.renderCoreSidebarElements) {
            appContext.renderCoreSidebarElements(); // Clears user info, etc.
        }

        if (appContext.liveEditor) {
            appContext.liveEditor.innerHTML = '';
            appContext.liveEditor.contentEditable = 'false'; // Make non-editable when logged out
            appContext.liveEditor.dataset.placeholder = "Please log in to start editing.";
            appContext.liveEditor.classList.add('is-empty');
        }
        if (appContext.currentPageDisplay) appContext.currentPageDisplay.textContent = 'Not logged in';
        if (appContext.savePageBtn) appContext.savePageBtn.disabled = true;

        if (appContext.announcementsSectionHeader) appContext.announcementsSectionHeader.innerHTML = '';
        if (appContext.announcementsContentArea) appContext.announcementsContentArea.innerHTML = '<p style="padding: 0 10px; font-size: 0.9em; color: var(--text-secondary);">Please log in to see announcements.</p>';
        if (appContext.projectsSectionHeader) appContext.projectsSectionHeader.innerHTML = '';
        if (appContext.projectsContentArea) appContext.projectsContentArea.innerHTML = '<p style="padding: 0 10px; font-size: 0.9em; color: var(--text-secondary);">Please log in to see projects.</p>';

        if (appContext.closeAllPeekModals) appContext.closeAllPeekModals(true);

        // Don't show status on logout, redirecting instead
        // if (appContext.showStatus) appContext.showStatus('Logged out successfully.', 'info');
        if (appContext.showLoginScreen) appContext.showLoginScreen();
    };

    // ... setupSidebarToggle function ... (keep as is)
     function setupSidebarToggle(appCtx) {
        const toggleButton = appCtx.sidebarToggleBtn;
        if (!toggleButton) {
            console.warn("Sidebar toggle button not found.");
            return;
        }
        const body = document.body;
        const icon = toggleButton.querySelector('i');

        function setSidebarState(isCollapsed) {
            if (isCollapsed) {
                body.classList.add('sidebar-collapsed');
                if (icon) {
                    icon.classList.remove('fa-chevron-left');
                    icon.classList.add('fa-chevron-right');
                }
                toggleButton.title = 'Expand Sidebar';
            } else {
                body.classList.remove('sidebar-collapsed');
                if (icon) {
                    icon.classList.remove('fa-chevron-right');
                    icon.classList.add('fa-chevron-left');
                }
                toggleButton.title = 'Collapse Sidebar';
            }
            if (appCtx.handlePeekModalLayoutChange) {
                setTimeout(() => appCtx.handlePeekModalLayoutChange(), 50);
            }
        }

        toggleButton.addEventListener('click', () => {
            const isCurrentlyCollapsed = body.classList.contains('sidebar-collapsed');
            setSidebarState(!isCurrentlyCollapsed);
            localStorage.setItem('sidebarCollapsed', !isCurrentlyCollapsed);
        });

        const savedState = localStorage.getItem('sidebarCollapsed') === 'true';
        setSidebarState(savedState);
    }


   // Initialize modules
   initAuth(appContext);
   initEditArea(appContext);
   initSidePanel(appContext);
   appContext.slashCommandInstance = initSlashCommand(appContext);
   initTextStyleModal(appContext);
   initTableEditor(appContext);
   initEmojiModal(appContext);
   initMoreOptionsModal(appContext);
   initEmbedPageModal(appContext);
   initUserSettingsModal(appContext); // This depends on appContext.applyTheme now
   initHomepage(appContext);
   initPagePeekModalSystem(appContext);
   setupSidebarToggle(appContext);


   // ... beforeunload listener ... (keep as is)
    window.addEventListener('beforeunload', (event) => {
       let unsavedInPeek = false;
       if (appContext.activePeekModals) {
           const sCMDActiveInPeek = appContext.activePeekModals.some(
               modal => modal.isSlashCommandActive && modal.slashCommandInfo && modal.slashCommandInfo.textNode.textContent.substring(modal.slashCommandInfo.offset).length > 0
           );
           if (sCMDActiveInPeek) {
               unsavedInPeek = true;
           }
           unsavedInPeek = unsavedInPeek || appContext.activePeekModals.some(modal => modal.hasUnsavedChanges && !modal.isMinimized && modal.contextType !== 'announcement');
       }

       let mainEditorUnsaved = false;
       if (appContext.hasUnsavedChanges && appContext.currentPageState) {
           if (appContext.currentPageState.type === 'announcement') {
               const isAdmin = appContext.currentUser && (appContext.currentUser.role === 'admin' || appContext.currentUser.role === 'owner');
               if (isAdmin) {
                   mainEditorUnsaved = true;
               }
           } else { // Project page
               mainEditorUnsaved = true;
           }
       }

       if (mainEditorUnsaved || unsavedInPeek) {
           event.preventDefault();
           event.returnValue = '';
           return 'You have unsaved changes. Are you sure you want to leave?';
       }
   });


   // ... keydown listener (for Escape key) ... (keep as is)
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Don't close modals if slash command is active inside them or main editor
            if (appContext.isSlashCommandActive) {
                return;
            }
            if (appContext.activePeekModals && appContext.activePeekModals.some(m => m.isSlashCommandActive)) {
                return;
            }

            const topPeekModal = appContext.getTopPeekModal ? appContext.getTopPeekModal() : null;
            if (topPeekModal && topPeekModal.domElement.style.display !== 'none' && !topPeekModal.isMinimized) {
                if (topPeekModal.close) topPeekModal.close();
                return;
            }
            if (appContext.actionsModal && appContext.actionsModal.style.display !== 'none') {
                appContext.actionsModal.style.display = 'none';
            }
            if (appContext.userSettingsModal && appContext.userSettingsModal.style.display !== 'none' && appContext.closeUserSettingsModal) {
                appContext.closeUserSettingsModal();
            }
             // Only close other modals if slash command *isn't* the reason they are open
             if (appContext.embedPageModal && appContext.embedPageModal.style.display !== 'none') {
                if (appContext.closeEmbedPageModal) { // Check if close func exists
                    appContext.closeEmbedPageModal();
                }
            }
             if (appContext.emojiModal && appContext.emojiModal.style.display !== 'none') {
                 if (appContext.closeEmojiModal) { // Check if close func exists
                    appContext.closeEmojiModal();
                 }
             }
            if (appContext.closeMoreOptionsModal) {
                appContext.closeMoreOptionsModal();
             }
        }
    });


    // ... actionsModal click listener ... (keep as is)
    if (appContext.actionsModal) {
        appContext.actionsModal.addEventListener('click', (event) => {
            if (event.target === appContext.actionsModal) {
                appContext.actionsModal.style.display = 'none';
            }
        });
    }


   // *** Updated Initial Auth Check ***
    // Apply theme preference from localStorage immediately if available
    const preferredTheme = localStorage.getItem('preferredTheme');
    if (preferredTheme && appContext.applyTheme) {
         appContext.applyTheme(preferredTheme);
    } else if(appContext.applyTheme) {
         appContext.applyTheme('dark'); // Default if nothing stored
    }

   if (appContext.checkAuthStatus) {
        appContext.checkAuthStatus()
            .then(async () => { // Make async to await settings fetch
                if (appContext.currentUser) {
                     // Fetch user settings AFTER successful auth
                     try {
                         const settingsResponse = await appContext.fetchWithAuth('/api/settings');
                         if (settingsResponse.ok) {
                             const settings = await settingsResponse.json();
                             appContext.userSettings = settings;
                             // Apply fetched theme, overriding localStorage if different
                             appContext.applyTheme(settings.theme || 'dark');
                         } else {
                              console.warn("Failed to fetch user settings, using default/localStorage theme.");
                              // Theme already applied from localStorage or default, no need to change
                         }
                     } catch (error) {
                          console.error("Error fetching user settings:", error);
                          // Theme already applied from localStorage or default
                     }

                    // Now render sidebar and load initial content
                    if (appContext.renderCoreSidebarElements) {
                        appContext.renderCoreSidebarElements();
                    }
                    if (appContext.currentView === 'home' && !appContext.currentProject && !appContext.currentPageState && !appContext.currentAnnouncementContext) {
                        if (appContext.displayHomepage) {
                            appContext.displayHomepage();
                        }
                        if (appContext.fetchAnnouncementsList) {
                            appContext.fetchAnnouncementsList();
                        }
                    } // Add other view logic if needed
                } else {
                     // User is not logged in (checkAuthStatus resolved, but currentUser is null)
                     if (appContext.renderCoreSidebarElements) {
                         appContext.renderCoreSidebarElements();
                     }
                     appContext.applyTheme('dark'); // Ensure default theme for guest/login view
                     if (appContext.showLoginScreen) appContext.showLoginScreen();
                 }
            })
            .catch(error => {
                 // This catch handles failure of checkAuthStatus itself (e.g., network error)
                 // or errors thrown by fetchWithAuth during the check (like 401 redirect handled in fetchWithAuth)
                console.error("Error during initial auth sequence:", error.message);
                 // Ensure UI reflects logged-out state
                 if (!appContext.currentUser) { // Double check if logout wasn't already called
                      if (appContext.renderCoreSidebarElements) {
                         appContext.renderCoreSidebarElements();
                     }
                     appContext.applyTheme('dark'); // Default theme
                     if (appContext.showLoginScreen) appContext.showLoginScreen();
                 }
                 // If fetchWithAuth already handled logout, showLoginScreen might already be called
            });
   } else {
       console.error("checkAuthStatus function not initialized. Auth will not work.");
       appContext.applyTheme('dark'); // Apply default theme
       if (appContext.showLoginScreen) appContext.showLoginScreen();
   }

   // ... Service Worker registration ... (keep as is)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered successfully with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
});