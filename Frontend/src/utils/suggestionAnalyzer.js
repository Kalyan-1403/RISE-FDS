/**
 * AI Suggestion Analyzer
 * Extracts common themes from student feedback comments
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'and',
  'but', 'or', 'if', 'while', 'that', 'this', 'it', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'my', 'your', 'his', 'her', 'its', 'our',
  'their', 'what', 'which', 'who', 'whom', 'these', 'those', 'am',
  'just', 'don', 'now', 'also', 'about', 'up', 'get', 'make', 'go',
  'like', 'well', 'back', 'much', 'even', 'still', 'way', 'take',
  'come', 'good', 'new', 'want', 'give', 'use', 'her', 'think',
  'say', 'help', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave',
  'call', 'sir', 'mam', 'madam', 'please', 'thank', 'thanks', 'class',
  'subject', 'faculty', 'teacher', 'professor', 'sir', 'ma', 'okay', 'ok',
]);

const THEME_KEYWORDS = {
  'teaching methodology': ['teaching', 'method', 'approach', 'technique', 'style', 'way of teaching', 'explain', 'explanation'],
  'communication': ['communication', 'language', 'english', 'voice', 'speak', 'speaking', 'audible', 'clarity', 'clear'],
  'practical sessions': ['practical', 'lab', 'hands-on', 'experiment', 'project', 'coding', 'practice'],
  'study materials': ['notes', 'material', 'ppt', 'slides', 'reference', 'book', 'resource', 'handout'],
  'doubt clearing': ['doubt', 'query', 'question', 'clarify', 'understand', 'confusion', 'difficult'],
  'punctuality': ['time', 'punctual', 'late', 'early', 'schedule', 'regular', 'attendance'],
  'syllabus coverage': ['syllabus', 'portion', 'complete', 'cover', 'topic', 'chapter', 'finish'],
  'assessment & evaluation': ['marks', 'exam', 'test', 'assignment', 'paper', 'correction', 'result', 'grade', 'evaluation'],
  'student engagement': ['boring', 'interesting', 'engage', 'interactive', 'attention', 'participate', 'involvement'],
  'improvement needed': ['improve', 'better', 'need', 'lack', 'poor', 'weak', 'bad', 'worst', 'problem', 'issue'],
  'appreciation': ['best', 'excellent', 'great', 'wonderful', 'amazing', 'fantastic', 'awesome', 'love', 'perfect', 'superb'],
};

export const analyzeSuggestions = (comments, collegeName, deptName, facultyName = null) => {
  if (!comments || comments.length === 0) {
    return {
      summary: 'No student suggestions available for analysis.',
      themes: [],
      rawCount: 0,
    };
  }

  // Filter out empty comments
  const validComments = comments.filter((c) => c && c.trim().length > 3);

  if (validComments.length === 0) {
    return {
      summary: 'No meaningful suggestions found in the responses.',
      themes: [],
      rawCount: 0,
    };
  }

  // Combine all comments
  const allText = validComments.join(' ').toLowerCase();

  // Find matching themes
  const detectedThemes = [];

  Object.entries(THEME_KEYWORDS).forEach(([theme, keywords]) => {
    let matchCount = 0;
    const matchedWords = [];

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = allText.match(regex);
      if (matches) {
        matchCount += matches.length;
        if (!matchedWords.includes(keyword)) matchedWords.push(keyword);
      }
    });

    if (matchCount > 0) {
      detectedThemes.push({
        theme,
        count: matchCount,
        matchedWords,
        percentage: ((matchCount / validComments.length) * 100).toFixed(1),
      });
    }
  });

  // Sort by frequency
  detectedThemes.sort((a, b) => b.count - a.count);

  // Extract word frequency for additional insights
  const wordFreq = {};
  allText
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .forEach((word) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

  const topWords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Build summary sentence
  const target = facultyName
    ? `regarding ${facultyName}`
    : deptName
    ? `from ${collegeName} College, ${deptName} Department`
    : `from ${collegeName} College`;

  let summary = '';

  if (detectedThemes.length === 0) {
    summary = `Students ${target} have provided general feedback without specific recurring themes.`;
  } else {
    const topThemes = detectedThemes.slice(0, 3);
    const isPositive = topThemes.some((t) => t.theme === 'appreciation');
    const needsWork = topThemes.some((t) => t.theme === 'improvement needed');

    if (isPositive && !needsWork) {
      summary = `Students ${target} are largely satisfied. They particularly appreciate the ${topThemes.map((t) => t.theme).join(', ')}.`;
    } else if (needsWork && !isPositive) {
      summary = `Students ${target} are suggesting improvements in: ${topThemes.map((t) => t.theme).join(', ')}. Immediate attention is recommended.`;
    } else {
      const positiveThemes = detectedThemes.filter((t) => t.theme === 'appreciation');
      const improvementThemes = detectedThemes.filter((t) => t.theme !== 'appreciation').slice(0, 3);

      summary = `Students ${target} have mixed feedback. `;
      if (positiveThemes.length > 0) {
        summary += `Positive aspects highlighted include overall appreciation. `;
      }
      if (improvementThemes.length > 0) {
        summary += `Areas flagged for improvement: ${improvementThemes.map((t) => t.theme).join(', ')}.`;
      }
    }
  }

  return {
    summary,
    themes: detectedThemes,
    topWords,
    rawCount: validComments.length,
    totalComments: comments.length,
  };
};