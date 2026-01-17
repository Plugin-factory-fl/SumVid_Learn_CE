/**
 * Tab Manager Module
 * Handles tab switching and content visibility management
 */

(function() {
  'use strict';

  class TabManager {
    constructor(tabButtons, tabContents) {
      this.tabButtons = Array.isArray(tabButtons) ? tabButtons : Array.from(tabButtons || []);
      this.tabContents = Array.isArray(tabContents) ? tabContents : Array.from(tabContents || []);
      this.activeTab = 'chat';
      this.onTabChangeCallbacks = [];
      
      this.init();
    }

    init() {
      // Add event listeners to tab buttons
      this.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchTab(btn.dataset.tab);
        });
      });
      
      // Ensure Chat tab is active by default
      this.switchTab('chat');
    }

    switchTab(tabName) {
      console.log('[TabManager] Switching to tab:', tabName);
      this.activeTab = tabName;
      
      // Update tab buttons
      this.tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      
      // CRITICAL: Hide ALL tab-content elements first by removing active class
      // CSS .tab-content { display: none !important; } will handle hiding
      this.tabContents.forEach(content => {
        content.classList.remove('active');
        // Remove any inline display styles - let CSS handle it
        content.style.removeProperty('display');
      });
      
      // CRITICAL: Ensure #video-info parent is visible (it might have .hidden class)
      const videoInfo = document.getElementById('video-info');
      if (videoInfo) {
        // Remove hidden class with verification
        videoInfo.classList.remove('hidden');
        
        // Verify it was removed
        if (videoInfo.classList.contains('hidden')) {
          console.error('[TabManager] WARNING: hidden class still present after removal attempt');
          // Force removal via className manipulation as fallback
          videoInfo.className = videoInfo.className.replace(/\bhidden\b/g, '').trim();
        }
        
        // Force visibility with inline style (highest priority)
        videoInfo.style.setProperty('display', 'flex', 'important');
        videoInfo.style.setProperty('visibility', 'visible', 'important');
        videoInfo.style.setProperty('opacity', '1', 'important');
        
        // Verify dimensions after forced visibility
        const videoInfoRect = videoInfo.getBoundingClientRect();
        console.log('[TabManager] video-info rect:', videoInfoRect.width, 'x', videoInfoRect.height);
        if (videoInfoRect.width === 0 || videoInfoRect.height === 0) {
          console.error('[TabManager] ERROR: video-info parent has zero dimensions!');
          // Last resort: force explicit dimensions
          const parentRect = videoInfo.parentElement?.getBoundingClientRect();
          if (parentRect && parentRect.height > 0) {
            videoInfo.style.setProperty('height', parentRect.height + 'px', 'important');
          }
        }
      }
      
      // Show only the active tab
      const activeTabContent = document.getElementById(`tab-${tabName}`);
      console.log('[TabManager] Active tab content element:', activeTabContent);
      if (activeTabContent) {
        // Add active class FIRST - CSS .tab-content.active { display: flex !important; } will handle showing
        activeTabContent.classList.add('active');
        // Then remove any conflicting inline display styles AFTER class is added
        // Don't remove display entirely - let CSS handle it via .active class
        
        // Verify only one tab is active
        const activeTabs = this.tabContents.filter(tab => tab.classList.contains('active'));
        console.log('[TabManager] Active tabs count:', activeTabs.length, activeTabs.map(t => t.id));
        if (activeTabs.length > 1) {
          console.error('[TabManager] ERROR: Multiple tabs have active class!', activeTabs.map(t => t.id));
        }
        
        console.log('[TabManager] Active class added, CSS .tab-content.active should handle display');
        
        // DEBUG: Check computed styles of tab-content itself
        const computedTabContent = window.getComputedStyle(activeTabContent);
        console.log('[TabManager] DEBUG - Tab content: display=' + computedTabContent.display + 
          ', visibility=' + computedTabContent.visibility + 
          ', opacity=' + computedTabContent.opacity + 
          ', height=' + computedTabContent.height + 
          ', width=' + computedTabContent.width);
        
        // CRITICAL: Force explicit dimensions on tab-content to prevent collapsing
        // For flashcards/quiz/notes, ensure tab-content has proper height AND width
        if (tabName === 'flashcards' || tabName === 'quiz' || tabName === 'notes') {
          // Get parent container dimensions
          const videoInfoRect = videoInfo?.getBoundingClientRect();
          const targetHeight = videoInfoRect && videoInfoRect.height > 0 
            ? Math.max(400, videoInfoRect.height - 100) 
            : 500;
          const targetWidth = videoInfoRect && videoInfoRect.width > 0
            ? videoInfoRect.width
            : 721; // Fallback width
          
          // Remove any existing dimension rules first, then set explicit dimensions
          activeTabContent.style.removeProperty('height');
          activeTabContent.style.removeProperty('min-height');
          activeTabContent.style.removeProperty('width');
          
          // Set explicit dimensions with !important to override CSS
          activeTabContent.style.setProperty('height', targetHeight + 'px', 'important');
          activeTabContent.style.setProperty('min-height', targetHeight + 'px', 'important');
          activeTabContent.style.setProperty('width', targetWidth + 'px', 'important');
          activeTabContent.style.setProperty('min-width', '100%', 'important');
          activeTabContent.style.setProperty('flex', '1 1 auto', 'important');
          activeTabContent.style.setProperty('display', 'flex', 'important');
          activeTabContent.style.setProperty('flex-direction', 'column', 'important');
          activeTabContent.style.setProperty('overflow', 'auto', 'important');
          activeTabContent.style.setProperty('visibility', 'visible', 'important');
          activeTabContent.style.setProperty('opacity', '1', 'important');
          
          console.log('[TabManager] Set tab-content dimensions to:', targetWidth + 'x' + targetHeight, 'px');
          
          // Use double requestAnimationFrame to ensure layout recalculation
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Force a reflow and verify
                void activeTabContent.offsetHeight;
                const computedStyle = window.getComputedStyle(activeTabContent);
                const tabRect = activeTabContent.getBoundingClientRect();
                const parentRect = activeTabContent.parentElement?.getBoundingClientRect();
                const videoInfoRect = videoInfo?.getBoundingClientRect();
                
                console.log('[TabManager] Tab content computed height:', computedStyle.height);
                console.log('[TabManager] Tab content computed width:', computedStyle.width);
                console.log('[TabManager] Tab content rect after height fix:', tabRect.width, 'x', tabRect.height);
                console.log('[TabManager] Parent rect:', parentRect?.width, 'x', parentRect?.height);
                console.log('[TabManager] video-info rect:', videoInfoRect?.width, 'x', videoInfoRect?.height);
                
                if (tabRect.height < 100 || tabRect.width === 0) {
                  console.error('[TabManager] ERROR: Tab content still collapsed after height fix!');
                  
                  // Parent is collapsed - force it to have dimensions
                  if (parentRect && (parentRect.width === 0 || parentRect.height === 0)) {
                    console.log('[TabManager] Parent is collapsed, forcing dimensions from video-info');
                    const parentEl = activeTabContent.parentElement;
                    if (parentEl && parentEl !== videoInfo) {
                      const videoInfoRect = videoInfo?.getBoundingClientRect();
                      if (videoInfoRect && videoInfoRect.width > 0) {
                        parentEl.style.setProperty('width', videoInfoRect.width + 'px', 'important');
                        parentEl.style.setProperty('min-width', '100%', 'important');
                        parentEl.style.setProperty('display', 'flex', 'important');
                        parentEl.style.setProperty('flex-direction', 'column', 'important');
                      }
                    }
                  }
                  
                  // Force width on tab-content itself from video-info
                  if (tabRect.width === 0 && videoInfoRect && videoInfoRect.width > 0) {
                    console.log('[TabManager] Forcing width from video-info:', videoInfoRect.width);
                    activeTabContent.style.setProperty('width', videoInfoRect.width + 'px', 'important');
                    activeTabContent.style.setProperty('min-width', '100%', 'important');
                  }
                }
              });
            });
          });
        }
        
        // Force a reflow to ensure CSS applies
        void activeTabContent.offsetHeight;
        
        // Ensure containers and content are visible for flashcards/quiz/notes tabs
        if (tabName === 'flashcards' || tabName === 'quiz' || tabName === 'notes') {
          // Don't remove height/min-height - let CSS flexbox work like summarize tab
          // The tab-content should get its height from flex: 1 and the parent container
          // Containers will push the tab-content to have proper height
          
          // Handle different naming conventions for notes (note-empty vs notes-empty)
          const container = activeTabContent.querySelector(`#${tabName === 'flashcards' ? 'flashcard' : tabName === 'quiz' ? 'quiz' : 'notes'}-container`);
          const content = activeTabContent.querySelector(`#${tabName === 'flashcards' ? 'flashcard' : tabName === 'quiz' ? 'quiz' : 'notes'}-content`);
          // Notes uses 'note-empty' not 'notes-empty'
          const emptyId = tabName === 'notes' ? 'note-empty' : `${tabName === 'flashcards' ? 'flashcard' : 'quiz'}-empty`;
          const empty = activeTabContent.querySelector(`#${emptyId}`);
          
          console.log('[TabManager] Elements found:', { container: !!container, content: !!content, empty: !!empty });
          
          // Set up containers - remove conflicting inline styles, let CSS handle display/flex
          if (container) {
            container.style.removeProperty('display');
            container.style.removeProperty('visibility');
            container.style.removeProperty('opacity');
            container.style.removeProperty('height');
            container.classList.remove('collapsed', 'hidden');
            // CSS already has min-height: 200px, let it work
            console.log('[TabManager] Container cleaned up');
          }
          if (content) {
            content.style.removeProperty('display');
            content.style.removeProperty('visibility');
            content.style.removeProperty('opacity');
            content.style.removeProperty('max-height');
            content.style.removeProperty('height');
            content.classList.remove('collapsed', 'hidden');
            console.log('[TabManager] Content cleaned up');
          }
          if (empty) {
            empty.style.removeProperty('display');
            empty.style.removeProperty('visibility');
            empty.style.removeProperty('opacity');
            empty.style.removeProperty('height');
            empty.classList.remove('hidden');
            // CSS should handle padding and dimensions
            console.log('[TabManager] Empty state cleaned up');
          }
          
          // Force a reflow so containers are laid out
          void activeTabContent.offsetHeight;
        }
      } else {
        console.error('[TabManager] Active tab content not found for:', tabName);
      }
      
      // Call registered callbacks
      this.onTabChangeCallbacks.forEach(callback => {
        try {
          callback(tabName);
        } catch (error) {
          console.error('[TabManager] Error in tab change callback:', error);
        }
      });
      
      // Regenerate suggestions when switching to chat tab
      if (tabName === 'chat' && window.chatManager) {
        console.log('[TabManager] Regenerating chat suggestions');
        window.chatManager.generateSuggestions();
      }
      
      // Render content when switching to flashcards, quiz, or notes tabs
      if (tabName === 'flashcards') {
        console.log('[TabManager] Rendering flashcards, controller exists:', !!window.flashcardUIController);
        
        // DEBUG: Check if elements exist
        const flashcardContainer = document.getElementById('flashcard-container');
        const flashcardContent = document.getElementById('flashcard-content');
        const flashcardEmpty = document.getElementById('flashcard-empty');
        const computedContainer = flashcardContainer ? window.getComputedStyle(flashcardContainer) : null;
        const computedContent = flashcardContent ? window.getComputedStyle(flashcardContent) : null;
        const computedEmpty = flashcardEmpty ? window.getComputedStyle(flashcardEmpty) : null;
        console.log('[TabManager] DEBUG - Flashcard container: display=' + (computedContainer?.display || 'null') + 
          ', visibility=' + (computedContainer?.visibility || 'null') + 
          ', height=' + (computedContainer?.height || 'null') + 
          ', width=' + (computedContainer?.width || 'null') +
          ', minHeight=' + (computedContainer?.minHeight || 'null') +
          ', opacity=' + (computedContainer?.opacity || 'null') +
          ', position=' + (computedContainer?.position || 'null'));
        console.log('[TabManager] DEBUG - Flashcard content: display=' + (computedContent?.display || 'null') + 
          ', visibility=' + (computedContent?.visibility || 'null') + 
          ', height=' + (computedContent?.height || 'null') + 
          ', width=' + (computedContent?.width || 'null') +
          ', minHeight=' + (computedContent?.minHeight || 'null'));
        console.log('[TabManager] DEBUG - Flashcard empty: display=' + (computedEmpty?.display || 'null') + 
          ', visibility=' + (computedEmpty?.visibility || 'null') + 
          ', height=' + (computedEmpty?.height || 'null') +
          ', width=' + (computedEmpty?.width || 'null') +
          ', innerHTML length=' + (flashcardEmpty?.innerHTML?.length || 0));
        
        if (window.flashcardUIController) {
          window.flashcardUIController.renderFlashcards().catch(err => {
            console.error('[TabManager] Error rendering flashcards:', err);
          });
        } else {
          console.warn('[TabManager] FlashcardUIController not available');
        }
      }
      
      if (tabName === 'quiz') {
        console.log('[TabManager] Rendering quiz, controller exists:', !!window.quizUIController);
        
        if (window.quizUIController) {
          window.quizUIController.renderQuiz().catch(err => {
            console.error('[TabManager] Error rendering quiz:', err);
          });
        } else {
          console.warn('[TabManager] QuizUIController not available');
        }
      }
      
      if (tabName === 'notes') {
        console.log('[TabManager] Rendering notes, controller exists:', !!window.notesUIController);
        
        // DEBUG: Check if elements exist
        const notesContainer = document.getElementById('notes-container');
        const notesContent = document.getElementById('notes-content');
        const notesList = document.getElementById('notes-list');
        const noteEmpty = document.getElementById('note-empty');
        const computedNotesContainer = notesContainer ? window.getComputedStyle(notesContainer) : null;
        const computedNotesContent = notesContent ? window.getComputedStyle(notesContent) : null;
        const computedNoteEmpty = noteEmpty ? window.getComputedStyle(noteEmpty) : null;
        console.log('[TabManager] DEBUG - Notes container: display=' + (computedNotesContainer?.display || 'null') + 
          ', visibility=' + (computedNotesContainer?.visibility || 'null') + 
          ', height=' + (computedNotesContainer?.height || 'null') + 
          ', minHeight=' + (computedNotesContainer?.minHeight || 'null'));
        console.log('[TabManager] DEBUG - Notes content: display=' + (computedNotesContent?.display || 'null') + 
          ', visibility=' + (computedNotesContent?.visibility || 'null') + 
          ', height=' + (computedNotesContent?.height || 'null') + 
          ', minHeight=' + (computedNotesContent?.minHeight || 'null'));
        console.log('[TabManager] DEBUG - Notes empty: display=' + (computedNoteEmpty?.display || 'null') + 
          ', visibility=' + (computedNoteEmpty?.visibility || 'null') + 
          ', height=' + (computedNoteEmpty?.height || 'null'));
        
        if (window.notesUIController) {
          const notesFilter = document.getElementById('notes-filter');
          const folder = notesFilter ? notesFilter.value : 'all';
          console.log('[TabManager] Rendering notes for folder:', folder);
          window.notesUIController.renderNotes(folder).catch(err => {
            console.error('[TabManager] Error rendering notes:', err);
          });
        } else {
          console.warn('[TabManager] NotesUIController not available');
        }
      }
    }

    getActiveTab() {
      return this.activeTab;
    }

    onTabChange(callback) {
      if (typeof callback === 'function') {
        this.onTabChangeCallbacks.push(callback);
      }
    }
  }

  // Export to global scope
  window.TabManager = TabManager;
})();
