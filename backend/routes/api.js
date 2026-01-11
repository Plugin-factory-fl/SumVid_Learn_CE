/**
 * API Routes
 * Handles AI API calls for summaries, quizzes, and Q&A
 */

import express from 'express';
import { authenticate } from '../config/auth.js';
import { query } from '../config/database.js';
import { resetDailyUsageIfNeeded, incrementUsage } from '../config/usage.js';

const router = express.Router();

// All API routes require authentication
router.use(authenticate);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn('[API] Warning: OPENAI_API_KEY not configured');
}

/**
 * Helper function to call OpenAI API
 */
async function callOpenAI(messages, maxTokens = 1500, temperature = 0.7) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * POST /api/summarize
 * Generate video summary
 */
router.post('/summarize', async (req, res) => {
  try {
    const { videoId, transcript, context, title } = req.body;
    const userId = req.user.userId;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Check usage limit before generation
    await resetDailyUsageIfNeeded(userId);
    const usageResult = await query(
      'SELECT enhancements_used, enhancements_limit FROM users WHERE id = $1',
      [userId]
    );

    if (usageResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = usageResult.rows[0];
    if (user.enhancements_used >= user.enhancements_limit) {
      return res.status(403).json({
        error: 'Daily enhancement limit reached',
        enhancementsUsed: user.enhancements_used,
        enhancementsLimit: user.enhancements_limit
      });
    }

    // Increment usage before generation
    const incrementResult = await incrementUsage(userId);
    if (!incrementResult.success) {
      return res.status(403).json({
        error: incrementResult.error || 'Failed to increment usage',
        usage: incrementResult.usage
      });
    }

    // Clean transcript
    const cleanTranscript = transcript.replace(/\[\d+:\d+\]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanTranscript.length < 10) {
      return res.status(400).json({ error: 'Transcript is too short or empty' });
    }

    // Calculate target word count
    const transcriptWordCount = cleanTranscript.split(/\s+/).length;
    const estimatedVideoMinutes = transcriptWordCount / 150;
    const targetReadingMinutes = estimatedVideoMinutes / 10;
    let targetWordCount = Math.round(targetReadingMinutes * 150);
    targetWordCount = Math.max(300, Math.min(2000, targetWordCount));
    const maxTokens = Math.round(targetWordCount * 1.2);

    // Generate summary
    const contextPrompt = context ? `\n\nAdditional context: ${context}` : '';
    const systemPrompt = `Summarize this video about ${title || 'the topic'} for a 5th grader, aiming for about ${targetWordCount} words. Use <h4> for headings and <strong> for important terms.${contextPrompt}`;

    const summary = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: cleanTranscript }
    ], maxTokens);

    // Get updated usage
    const updatedUsageResult = await query(
      'SELECT enhancements_used, enhancements_limit FROM users WHERE id = $1',
      [userId]
    );
    const updatedUsage = updatedUsageResult.rows[0];

    res.json({
      summary,
      usage: {
        enhancementsUsed: updatedUsage.enhancements_used,
        enhancementsLimit: updatedUsage.enhancements_limit,
        remaining: Math.max(0, updatedUsage.enhancements_limit - updatedUsage.enhancements_used)
      }
    });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

/**
 * POST /api/quiz
 * Generate quiz questions
 */
router.post('/quiz', async (req, res) => {
  try {
    const { videoId, transcript, summary, difficulty, title } = req.body;
    const userId = req.user.userId;

    if (!transcript && !summary) {
      return res.status(400).json({ error: 'Transcript or summary is required' });
    }

    // Check usage limit before generation
    await resetDailyUsageIfNeeded(userId);
    const usageResult = await query(
      'SELECT enhancements_used, enhancements_limit FROM users WHERE id = $1',
      [userId]
    );

    if (usageResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = usageResult.rows[0];
    if (user.enhancements_used >= user.enhancements_limit) {
      return res.status(403).json({
        error: 'Daily enhancement limit reached',
        enhancementsUsed: user.enhancements_used,
        enhancementsLimit: user.enhancements_limit
      });
    }

    // Increment usage before generation
    const incrementResult = await incrementUsage(userId);
    if (!incrementResult.success) {
      return res.status(403).json({
        error: incrementResult.error || 'Failed to increment usage',
        usage: incrementResult.usage
      });
    }

    // Generate quiz
    const contextToUse = difficulty ? `\n\nThe user requests: ${difficulty} difficulty` : '';
    const systemPrompt = `You are making a quiz about a YouTube video. Create EXACTLY 3 multiple-choice questions that a 5th grader can understand.${contextToUse}
Topic: ${title || 'unknown topic'}
Follow these rules:
1. Make EXACTLY 3 questions
2. Use simple words and short sentences
3. Ask about the main ideas from the video
4. Make questions clear and easy to understand
5. Focus on the important parts
6. Use words that a 5th grader knows
7. Each question needs 3 choices (A, B, C)
8. Only one answer should be right
9. Wrong answers should make sense but be clearly wrong
10. Use this exact format for each question:
<div class="question">
  <p class="question-text">1. Your question text here?</p>
  <div class="answers">
    <label class="answer">
      <input type="radio" name="q1" value="a">
      <span>Answer A</span>
    </label>
    <label class="answer">
      <input type="radio" name="q1" value="b">
      <span>Answer B</span>
    </label>
    <label class="answer">
      <input type="radio" name="q1" value="c">
      <span>Answer C</span>
    </label>
  </div>
  <div class="correct-answer" style="display: none;">a</div>
</div>

11. After all questions, add this navigation structure:
<div class="quiz-navigation">
  <span id="questionCounter">Question 1/3</span>
  <div class="quiz-nav-controls">
    <button id="prevQuestion" class="nav-button" disabled>&lt;</button>
    <button id="nextQuestion" class="nav-button">&gt;</button>
    <button id="submitQuiz" class="submit-quiz">Submit Quiz</button>
  </div>
</div>

- Use q1, q2, q3 for the radio button names
- Use a, b, c for the radio button values
- Include the correct answer in the hidden div
- Number questions 1, 2, 3
- Make all 3 questions in one response
- Check that you have exactly 3 questions`;

    const content = summary ? `Transcript: ${transcript || ''}\n\nSummary: ${summary}${contextToUse}` : `Transcript: ${transcript}${contextToUse}`;

    const quiz = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content }
    ], 1500);

    // Verify we got exactly 3 questions
    const questionCount = (quiz.match(/<div class="question">/g) || []).length;
    if (questionCount !== 3) {
      console.warn(`[API] Generated ${questionCount} questions instead of 3`);
    }

    // Get updated usage
    const updatedUsageResult = await query(
      'SELECT enhancements_used, enhancements_limit FROM users WHERE id = $1',
      [userId]
    );
    const updatedUsage = updatedUsageResult.rows[0];

    res.json({
      quiz,
      usage: {
        enhancementsUsed: updatedUsage.enhancements_used,
        enhancementsLimit: updatedUsage.enhancements_limit,
        remaining: Math.max(0, updatedUsage.enhancements_limit - updatedUsage.enhancements_used)
      }
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate quiz' });
  }
});

/**
 * POST /api/qa
 * Answer questions about the video
 */
router.post('/qa', async (req, res) => {
  try {
    const { videoId, transcript, question, chatHistory, summary, title } = req.body;
    const userId = req.user.userId;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!transcript && !summary) {
      return res.status(400).json({ error: 'Transcript or summary is required' });
    }

    // Check usage limit before generation
    await resetDailyUsageIfNeeded(userId);
    const usageResult = await query(
      'SELECT enhancements_used, enhancements_limit FROM users WHERE id = $1',
      [userId]
    );

    if (usageResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = usageResult.rows[0];
    if (user.enhancements_used >= user.enhancements_limit) {
      return res.status(403).json({
        error: 'Daily enhancement limit reached',
        enhancementsUsed: user.enhancements_used,
        enhancementsLimit: user.enhancements_limit
      });
    }

    // Increment usage before generation
    const incrementResult = await incrementUsage(userId);
    if (!incrementResult.success) {
      return res.status(403).json({
        error: incrementResult.error || 'Failed to increment usage',
        usage: incrementResult.usage
      });
    }

    // Build messages array with chat history
    const messages = [
      {
        role: 'system',
        content: `You are helping a 5th grader understand a YouTube video titled "${title || 'unknown video'}". Give short, simple answers that are easy to understand. Use basic words and short sentences. If you're not sure about something, just say so in a simple way.

Rules:
1. Keep answers short (2-3 sentences if possible)
2. Use words that a 5th grader knows
3. Break down complex ideas into simple parts
4. Use examples when it helps
5. Be friendly and encouraging
6. If you need to use a big word, explain what it means
7. Focus on the main points
8. Keep explanations clear and direct`
      }
    ];

    // Add chat history if provided
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach(msg => {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Add current context
    const contextContent = summary
      ? `Video transcript: ${transcript || ''}\n\nVideo summary: ${summary}\n\nQuestion: ${question}`
      : `Video transcript: ${transcript}\n\nQuestion: ${question}`;

    messages.push({ role: 'user', content: contextContent });

    // Generate answer
    const answer = await callOpenAI(messages, 150, 0.7);

    // Get updated usage
    const updatedUsageResult = await query(
      'SELECT enhancements_used, enhancements_limit FROM users WHERE id = $1',
      [userId]
    );
    const updatedUsage = updatedUsageResult.rows[0];

    res.json({
      answer,
      usage: {
        enhancementsUsed: updatedUsage.enhancements_used,
        enhancementsLimit: updatedUsage.enhancements_limit,
        remaining: Math.max(0, updatedUsage.enhancements_limit - updatedUsage.enhancements_used)
      }
    });
  } catch (error) {
    console.error('Q&A error:', error);
    res.status(500).json({ error: error.message || 'Failed to answer question' });
  }
});

export default router;
