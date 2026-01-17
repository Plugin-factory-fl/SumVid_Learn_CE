/**
 * Button Handlers Module
 * Handles all button click events (summarize, quiz, regenerate, etc.)
 */

(function() {
  'use strict';

  const BACKEND_URL = 'https://sumvid-learn-backend.onrender.com';

  class ButtonHandlers {
    constructor(options = {}) {
      this.contentDisplayManager = options.contentDisplayManager;
      this.summaryContainer = options.summaryContainer;
      this.summaryContent = options.summaryContent;
      // Quiz handling moved to QuizUIController
      this.chatMessages = options.chatMessages;
      
      this.init();
    }

    init() {
      this.setupSummarizeButton();
      this.setupMakeTestButton();
      this.setupRegenerateButtons();
    }

    async checkUsageLimit() {
      if (window.usageManager) {
        return await window.usageManager.checkUsageLimit();
      }
      if (window.UsageTracker) {
        return await window.UsageTracker.isLimitReached();
      }
      return false;
    }

    getVideoId(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('v');
      } catch (error) {
        console.error('Error parsing video URL:', error);
        return null;
      }
    }

    setupSummarizeButton() {
      const summarizeButton = document.getElementById('summarize-button');
      if (!summarizeButton) return;

      summarizeButton.addEventListener('click', async () => {
        const currentVideoInfo = this.contentDisplayManager?.getCurrentVideoInfo();
        if (!currentVideoInfo) {
          alert('No content available to summarize.');
          return;
        }

        const contentType = currentVideoInfo.type || 'video';
        const hasContent = contentType === 'video' 
          ? currentVideoInfo.transcript 
          : (currentVideoInfo.text || currentVideoInfo.needsServerExtraction);
        
        if (!hasContent) {
          const errorMsg = contentType === 'video' 
            ? 'No video transcript available.'
            : contentType === 'pdf'
            ? 'No PDF content available.'
            : 'No webpage content available.';
          alert(errorMsg);
          return;
        }

        const limitReached = await this.checkUsageLimit();
        if (limitReached) {
          alert('Daily enhancement limit reached. Your limit will reset tomorrow.');
          return;
        }

        summarizeButton.disabled = true;
        summarizeButton.textContent = 'Generating...';
        
        if (this.summaryContainer) this.summaryContainer.classList.remove('hidden');
        if (this.summaryContent) {
          this.summaryContent.style.display = 'block';
          this.summaryContent.innerHTML = '<div class="summary-text">Generating summary...</div>';
        }
        if (window.showLoadingIndicator) {
          window.showLoadingIndicator(this.summaryContainer);
        }

        try {
          const contentText = contentType === 'video' 
            ? currentVideoInfo.transcript 
            : (currentVideoInfo.text || '');
          
          if (window.summarizeText) {
            await window.summarizeText(contentText, false, '');
          }
          
          const regenerateButton = document.getElementById('regenerate-summary-button');
          if (regenerateButton) regenerateButton.style.display = 'block';
          summarizeButton.style.display = 'none';
          
          if (window.usageManager) {
            await window.usageManager.updateStatusCards();
          }
        } catch (error) {
          console.error('Error generating summary:', error);
          alert('Failed to generate summary. Please try again.');
          summarizeButton.disabled = false;
          summarizeButton.textContent = 'Summarize';
        }
      });
    }

    setupMakeTestButton() {
      const makeTestButton = document.getElementById('make-test-button');
      if (!makeTestButton) return;

      // Button handler is now managed by QuizUIController
      // This method is kept for compatibility but the actual handler is set up in QuizUIController.initializeQuizUI()
      // The button click will be handled by QuizUIController.handleGenerateQuiz()
    }

    setupRegenerateButtons() {
      // Regenerate summary button
      const regenerateSummaryButton = document.getElementById('regenerate-summary-button');
      if (regenerateSummaryButton) {
        regenerateSummaryButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          const currentVideoInfo = this.contentDisplayManager?.getCurrentVideoInfo();
          
          if (!currentVideoInfo?.transcript) {
            console.warn('No transcript available for summary regeneration');
            return;
          }

          const limitReached = await this.checkUsageLimit();
          if (limitReached) {
            alert('Daily enhancement limit reached. Your limit will reset tomorrow.');
            return;
          }

          const videoId = this.getVideoId(currentVideoInfo.url);
          if (videoId) {
            chrome.storage.local.remove([
              `summary_${videoId}`,
              `quiz_${videoId}`,
              `chat_${videoId}`
            ]);
          }

          const userContext = this.contentDisplayManager?.getUserContext();
          if (userContext) {
            userContext.summary = '';
          }

          if (window.summarizeText) {
            await window.summarizeText(currentVideoInfo.transcript, true, '');
          }
          
          if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
            if (window.showPlayfulMessage) {
              window.showPlayfulMessage();
            }
          }
          
          if (window.usageManager) {
            await window.usageManager.updateStatusCards();
          }
        });
      }

      // Regenerate quiz button handler is now managed by QuizUIController
      // This method is kept for compatibility but the actual handler is set up in QuizUIController.initializeQuizUI()
    }
  }

  // Export to global scope
  window.ButtonHandlers = ButtonHandlers;
})();
