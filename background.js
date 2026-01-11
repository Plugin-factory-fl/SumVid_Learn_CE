// Backend API configuration
const BACKEND_URL = 'https://sumvid-learn-backend.onrender.com'; // Update with your backend URL

// Helper function to get JWT token from storage
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sumvid_auth_token'], (result) => {
      resolve(result.sumvid_auth_token || null);
    });
  });
}

// Helper function to save JWT token to storage
async function saveAuthToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ sumvid_auth_token: token }, () => {
      resolve();
    });
  });
}

// Helper function to remove auth token
async function clearAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['sumvid_auth_token'], () => {
      resolve();
    });
  });
}

// Helper function to make authenticated backend API calls
async function callBackendAPI(endpoint, method = 'POST', body = null) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated. Please log in.');
  }

  const url = `${BACKEND_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    // Token expired or invalid, clear it
    await clearAuthToken();
    throw new Error('Authentication expired. Please log in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
}

let currentVideoInfo = null;
let transcriptCache = new Map();

// Helper to generate summary via backend API
async function generateSummary(transcript, context, title, videoId) {
  const cleanTranscript = transcript.replace(/\[\d+:\d+\]/g, '').replace(/\s+/g, ' ').trim();
  if (cleanTranscript.length < 10) throw new Error('Transcript is too short or empty');

  const response = await callBackendAPI('/api/summarize', 'POST', {
    videoId: videoId || null,
    transcript: cleanTranscript,
    context: context || '',
    title: title || 'unknown video'
  });

  return response.summary;
}

// Helper to generate quiz via backend API
async function generateQuiz(transcript, summary, context, title, videoId) {
  const response = await callBackendAPI('/api/quiz', 'POST', {
    videoId: videoId || null,
    transcript: transcript || '',
    summary: summary || '',
    difficulty: context || '',
    title: title || 'unknown video'
  });

  const quiz = response.quiz;
  // Verify we got exactly 3 questions
  const questionCount = (quiz.match(/<div class="question">/g) || []).length;
  if (questionCount !== 3) {
    console.warn(`Generated ${questionCount} questions instead of 3`);
  }
  return quiz;
}

// Auto-generation removed - users must manually trigger generation via buttons

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_INFO') {
    (async () => {
      try {
        const url = sanitizeInput(message.data?.url);
        if (!url) throw new Error('No URL provided');
        
        const videoId = new URL(url).searchParams.get('v');
        if (!videoId) throw new Error('Invalid YouTube URL');
        
        currentVideoInfo = {
          ...message.data,
          title: sanitizeInput(message.data.title),
          channel: sanitizeInput(message.data.channel),
          transcript: message.data.transcript ? sanitizeInput(message.data.transcript) : null
        };
        
        await chrome.storage.local.set({ currentVideoInfo });
        
        if (currentVideoInfo.transcript && !currentVideoInfo.error) {
          transcriptCache.set(videoId, currentVideoInfo.transcript);
          // Don't auto-generate - user must click buttons manually
        } else {
          chrome.action.setBadgeText({ text: 'X' });
          chrome.action.setBadgeBackgroundColor({ color: '#808080' });
        }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error processing video info:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  } else if (message.action === 'summarize') {
    (async () => {
      try {
        const videoId = currentVideoInfo?.url ? new URL(currentVideoInfo.url).searchParams.get('v') : null;
        const summary = await generateSummary(message.transcript, message.context, currentVideoInfo?.title, videoId);
        sendResponse({ success: true, summary });
      } catch (error) {
        console.error('Summarization error:', error);
        sendResponse({ success: false, error: error.message || 'Failed to generate summary' });
      }
    })();
    return true;
  } else if (message.action === 'generate-quiz') {
    (async () => {
      try {
        const videoId = currentVideoInfo?.url ? new URL(currentVideoInfo.url).searchParams.get('v') : null;
        const questions = await generateQuiz(message.transcript, message.summary, message.context, currentVideoInfo?.title, videoId);
        sendResponse({ success: true, questions });
      } catch (error) {
        console.error('Quiz generation error:', error);
        sendResponse({ success: false, error: error.message || 'Failed to generate quiz' });
      }
    })();
    return true;
  } else if (message.action === 'ask-question') {
    (async () => {
      try {
        const videoId = currentVideoInfo?.url ? new URL(currentVideoInfo.url).searchParams.get('v') : null;
        const response = await callBackendAPI('/api/qa', 'POST', {
          videoId: videoId || null,
          transcript: message.transcript || '',
          question: message.question,
          chatHistory: message.chatHistory || null,
          summary: message.summary || '',
          title: currentVideoInfo?.title || 'unknown video'
        });
        sendResponse({ success: true, answer: response.answer });
      } catch (error) {
        console.error('Question answering error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to answer question'
        });
      }
    })();
    return true;
  } else if (message.type === 'AUTH_TOKEN') {
    // Handle auth token updates from login menu
    (async () => {
      try {
        if (message.token) {
          await saveAuthToken(message.token);
          sendResponse({ success: true });
        } else if (message.action === 'clear') {
          await clearAuthToken();
          sendResponse({ success: true });
        } else {
          const token = await getAuthToken();
          sendResponse({ success: true, token });
        }
      } catch (error) {
        console.error('Auth token error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes('youtube.com/watch')) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#808080' });
  } else if (changeInfo.status === 'complete' && tab.url && !tab.url.includes('youtube.com')) {
    chrome.action.setBadgeText({ text: '' });
    currentVideoInfo = null;
    chrome.storage.local.remove('currentVideoInfo');
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  transcriptCache.clear();
  chrome.storage.local.remove('currentVideoInfo');
  chrome.action.setBadgeText({ text: '' });
  
  chrome.storage.local.get(['darkMode'], (result) => {
    if (result.darkMode === undefined) {
      chrome.storage.local.set({ darkMode: false });
    }
  });
});