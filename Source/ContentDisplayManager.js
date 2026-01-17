/**
 * Content Display Manager Module
 * Handles content info display, state management, and initialization
 */

(function() {
  'use strict';

  class ContentDisplayManager {
    constructor(options = {}) {
      this.loadingState = options.loadingState;
      this.noVideoState = options.noVideoState;
      this.videoInfoState = options.videoInfoState;
      this.videoTitle = options.videoTitle;
      this.channelName = options.channelName;
      this.summaryContainer = options.summaryContainer;
      this.summaryContent = options.summaryContent;
      this.summaryHeader = options.summaryHeader;
      this.quizContainer = options.quizContainer;
      this.quizContent = options.quizContent;
      this.quizHeader = options.quizHeader;
      this.chatMessages = options.chatMessages;
      this.questionInput = options.questionInput;
      this.sendQuestionButton = options.sendQuestionButton;
      
      this.currentVideoInfo = null;
      this.userContext = { summary: '', quiz: '' };
    }

    showState(stateElement) {
      if (!stateElement) return;

      // Don't hide the element we're about to show
      if (this.loadingState && this.loadingState !== stateElement) {
        this.loadingState.classList.add('hidden');
      }
      if (this.noVideoState && this.noVideoState !== stateElement) {
        this.noVideoState.classList.add('hidden');
      }
      if (this.videoInfoState && this.videoInfoState !== stateElement) {
        this.videoInfoState.classList.add('hidden');
      }
      
      stateElement.classList.remove('hidden');
      
      // CRITICAL: If showing video-info, ensure it's visible
      if (stateElement.id === 'video-info') {
        stateElement.style.setProperty('display', 'flex', 'important');
        stateElement.style.setProperty('visibility', 'visible', 'important');
        stateElement.style.setProperty('opacity', '1', 'important');
      }
    }

    async requestContentInfo() {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs?.[0];
        
        if (currentTab?.id) {
          const response = await this.sendMessageWithTimeout({ type: 'REQUEST_CONTENT_INFO' });
          if (response?.error) {
            console.warn('Error requesting content info:', response.error);
          }
        }
      } catch (error) {
        console.warn('Error requesting content info:', error);
      }
    }

    async sendMessageWithTimeout(message, maxRetries = 3) {
      return new Promise((resolve) => {
        let retryCount = 0;

        function attemptSend() {
          try {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
              console.warn('Chrome runtime not available');
              resolve({ error: 'Chrome runtime not available' });
              return;
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (chrome.runtime.lastError) {
                console.warn('Chrome runtime error in tabs.query:', chrome.runtime.lastError);
                handleRetry();
                return;
              }

              const currentTab = tabs?.[0];
              if (!currentTab?.id) {
                resolve({ error: 'No active tab' });
                return;
              }

              chrome.tabs.sendMessage(currentTab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                  console.warn('Error sending message:', chrome.runtime.lastError.message);
                  handleRetry();
                  return;
                }
                resolve(response || {});
              });
            });
          } catch (error) {
            console.warn('Error in sendMessageWithTimeout:', error);
            handleRetry();
          }
        }

        function handleRetry() {
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(attemptSend, 500 * retryCount);
          } else {
            resolve({ error: 'Failed after retries' });
          }
        }

        attemptSend();
      });
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

    async initializeExtension() {
      try {
        const stored = await chrome.storage.local.get(['currentContentInfo', 'currentVideoInfo']);
        const contentInfo = stored.currentContentInfo || stored.currentVideoInfo;
        
        if (contentInfo) {
          await this.displayVideoInfo(contentInfo);
          return;
        }
        
        this.showState(this.loadingState);
        const loadingText = this.loadingState?.querySelector('p');
        if (loadingText) loadingText.textContent = 'Extracting content...';
        await this.requestContentInfo();
      } catch (error) {
        console.warn('Error initializing extension:', error);
        this.showState(this.videoInfoState);
      }
    }

    async displayVideoInfo(contentInfo) {
      if (!contentInfo) {
        this.showState(this.videoInfoState);
        if (this.chatMessages && this.chatMessages.children.length === 0) {
          if (window.showPlayfulMessage) {
            window.showPlayfulMessage();
          }
        }
        return;
      }
      
      this.currentVideoInfo = contentInfo;
      this.userContext = { summary: '', quiz: '' };
      
      if (this.videoTitle) {
        const titleText = contentInfo.title || 'Untitled Content';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = titleText;
        this.videoTitle.textContent = tempDiv.textContent || tempDiv.innerText || titleText;
      }
      
      if (this.channelName) {
        const sourceText = contentInfo.channel || contentInfo.url || 'Unknown Source';
        const copyUrlButton = document.getElementById('copy-url-button');
        
        if (contentInfo.url && !contentInfo.channel) {
          if (this.channelName) {
            this.channelName.textContent = '';
            this.channelName.style.display = 'none';
          }
          if (copyUrlButton) {
            copyUrlButton.dataset.fullUrl = contentInfo.url;
            copyUrlButton.style.display = 'flex';
            const svg = copyUrlButton.querySelector('svg');
            if (svg) {
              copyUrlButton.innerHTML = svg.outerHTML + ' Copy URL';
            } else {
              copyUrlButton.textContent = 'Copy URL';
            }
          }
        } else {
          if (this.channelName) {
            this.channelName.textContent = sourceText;
            this.channelName.style.display = 'block';
          }
          if (copyUrlButton) {
            copyUrlButton.style.display = 'none';
          }
        }
      }
      
      if (contentInfo.duration && window.contentGenerator) {
        window.contentGenerator.updateInfoCenter(contentInfo.duration, '');
      }
      
      this.summaryContainer?.classList.remove('hidden');
      this.quizContainer?.classList.remove('hidden');
      
      const hasContent = contentInfo.transcript || contentInfo.text || contentInfo.needsServerExtraction;
      const summarizeButton = document.getElementById('summarize-button');
      
      if (hasContent) {
        if (summarizeButton) {
          summarizeButton.disabled = false;
          summarizeButton.textContent = 'Summarize';
          summarizeButton.classList.remove('btn--disabled');
        }
        // Don't set inline display: none - let CSS and TabManager handle visibility
        // Content will be shown when user switches to the appropriate tab
      } else {
        if (summarizeButton) {
          summarizeButton.disabled = true;
          summarizeButton.textContent = 'No content to summarize';
          summarizeButton.classList.add('btn--disabled');
        }
      }
      
      this.showState(this.videoInfoState);
      if (this.chatMessages && this.chatMessages.children.length === 0) {
        if (window.showPlayfulMessage) {
          window.showPlayfulMessage();
        }
      }
    }

    async displayVideoInfoFromCache(videoInfo, videoId, cachedSummary, cachedQuiz, cachedChat) {
      this.currentVideoInfo = videoInfo;
      this.userContext = { summary: '', quiz: '' };
      
      try {
        const basicInfo = await this.sendMessageWithTimeout({ type: 'GET_BASIC_VIDEO_INFO' });
        if (basicInfo && !basicInfo.error) {
          this.currentVideoInfo = { ...videoInfo, ...basicInfo };
          if (this.videoTitle) {
            const titleText = basicInfo.title || 'Unknown Title';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = titleText;
            this.videoTitle.textContent = tempDiv.textContent || tempDiv.innerText || titleText;
          }
          if (this.channelName) {
            this.channelName.textContent = basicInfo.channel || 'Unknown Channel';
          }
        }
      } catch (error) {
        console.warn('Could not get basic video info:', error);
      }
      
      if (cachedSummary) {
        this.summaryContainer?.classList.remove('hidden');
        if (this.summaryContent) {
          this.summaryContent.style.display = 'block';
        }
        const summaryTextElement = document.querySelector('.summary-text');
        const summaryInfoCenter = document.querySelector('.summary-info-center');
        if (summaryTextElement) {
          summaryTextElement.innerHTML = cachedSummary;
        }
        if (summaryInfoCenter) {
          summaryInfoCenter.classList.remove('hidden');
          if (window.contentGenerator) {
            window.contentGenerator.updateInfoCenter(this.currentVideoInfo?.duration, cachedSummary);
          }
        }
        if (window.showCompletionBadge) {
          window.showCompletionBadge(this.summaryContainer);
        }
        if (this.summaryContent) {
          this.summaryContent.classList.add('collapsed');
        }
        if (this.summaryHeader) {
          this.summaryHeader.querySelector('.collapse-button')?.classList.add('collapsed');
        }
        
        const summarizeButton = document.getElementById('summarize-button');
        const regenerateSummaryButton = document.getElementById('regenerate-summary-button');
        if (summarizeButton) summarizeButton.style.display = 'none';
        if (regenerateSummaryButton) regenerateSummaryButton.style.display = 'block';
      } else {
        const summarizeButton = document.getElementById('summarize-button');
        const regenerateSummaryButton = document.getElementById('regenerate-summary-button');
        if (summarizeButton) summarizeButton.style.display = 'block';
        if (regenerateSummaryButton) regenerateSummaryButton.style.display = 'none';
      }
      
      if (cachedChat && window.chatManager) {
        await window.chatManager.loadCachedChat(videoId);
      } else {
        if (this.chatMessages) {
          this.chatMessages.innerHTML = '';
          if (window.showPlayfulMessage) {
            window.showPlayfulMessage();
          }
        }
      }
      
      this.quizContainer?.classList.remove('hidden');
      if (cachedQuiz) {
        if (this.quizContent) {
          // Don't set inline display - let CSS and TabManager handle it
          this.quizContent.innerHTML = cachedQuiz;
          // Don't add collapsed class - let TabManager handle visibility when tab is active
        }
        if (this.quizHeader) {
          this.quizHeader.querySelector('.collapse-button')?.classList.add('collapsed');
        }
        // Quiz navigation and submit button are now handled by QuizUIController
        if (window.showCompletionBadge) {
          window.showCompletionBadge(this.quizContainer);
        }
        
        const makeTestButton = document.getElementById('make-test-button');
        const regenerateQuizButton = document.getElementById('regenerate-quiz-button');
        if (makeTestButton) makeTestButton.style.display = 'none';
        if (regenerateQuizButton) regenerateQuizButton.style.display = 'block';
      } else {
        // Don't set inline display: none - let CSS handle it
        // Content will be shown when user switches to quiz tab
        if (this.quizHeader) {
          this.quizHeader.querySelector('.collapse-button')?.classList.add('collapsed');
        }
        const makeTestButton = document.getElementById('make-test-button');
        const regenerateQuizButton = document.getElementById('regenerate-quiz-button');
        if (makeTestButton) makeTestButton.style.display = 'block';
        if (regenerateQuizButton) regenerateQuizButton.style.display = 'none';
      }
      
      if (window.usageManager) {
        await window.usageManager.updateStatusCards();
      }
      
      this.showState(this.videoInfoState);
    }

    getCurrentVideoInfo() {
      return this.currentVideoInfo;
    }

    setCurrentVideoInfo(info) {
      this.currentVideoInfo = info;
    }

    getUserContext() {
      return this.userContext;
    }

    setUserContext(context) {
      this.userContext = context;
    }
  }

  // Export to global scope
  window.ContentDisplayManager = ContentDisplayManager;
})();
