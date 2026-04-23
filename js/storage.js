// storage.js - localStorage 读写
const STORAGE_KEY = 'quiz_progress_v2';

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {
    totalAttempts: 0,
    correctAttempts: 0,
    wrongQuestions: [],
    wrongQuizName: null
  };
  try {
    return JSON.parse(raw);
  } catch {
    return {
      totalAttempts: 0,
      correctAttempts: 0,
      wrongQuestions: [],
      wrongQuizName: null
    };
  }
}

function addWrongQuestion(question, yourAnswer) {
  const progress = loadProgress();
  const idx = progress.wrongQuestions.findIndex(q => q.question === question.question && q.quizName === question.quizName);
  if (idx >= 0) {
    progress.wrongQuestions[idx].wrongCount = (progress.wrongQuestions[idx].wrongCount || 1) + 1;
    progress.wrongQuestions[idx].lastWrongAnswer = yourAnswer;
  } else {
    progress.wrongQuestions.push({
      question: question.question,
      quizName: question.quizName,
      yourAnswer: yourAnswer,
      correctAnswer: question.answer,
      type: question.type,
      options: question.options,
      explanation: question.explanation,
      wrongCount: 1
    });
  }
  saveProgress(progress);
}

function removeWrongQuestion(questionText, quizName) {
  const progress = loadProgress();
  progress.wrongQuestions = progress.wrongQuestions.filter(
    q => !(q.question === questionText && q.quizName === quizName)
  );
  saveProgress(progress);
}

function clearWrongQuestions() {
  const progress = loadProgress();
  progress.wrongQuestions = [];
  saveProgress(progress);
}

function incrementAttempt(correct) {
  const progress = loadProgress();
  progress.totalAttempts++;
  if (correct) progress.correctAttempts++;
  saveProgress(progress);
}

function exportProgress() {
  const data = JSON.stringify(loadProgress(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quiz_progress.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        saveProgress(data);
        resolve();
      } catch (err) {
        reject(new Error('文件格式错误'));
      }
    };
    reader.readAsText(file);
  });
}

// 题库元数据管理（增强版）
function saveQuizMeta(metaArray) {
  localStorage.setItem('quiz_meta', JSON.stringify(metaArray));
}

function updateQuizStats(quizName, stats) {
  const metaRaw = localStorage.getItem('quiz_meta');
  let meta = metaRaw ? JSON.parse(metaRaw) : [];
  const idx = meta.findIndex(m => m.name === quizName);
  if (idx >= 0) {
    meta[idx] = { ...meta[idx], ...stats };
  }
  localStorage.setItem('quiz_meta', JSON.stringify(meta));
}

function getQuizMeta() {
  const raw = localStorage.getItem('quiz_meta');
  return raw ? JSON.parse(raw) : [];
}

// 收藏管理
function addFavorite(question) {
  const progress = loadProgress();
  if (!progress.favorites) progress.favorites = [];
  const exists = progress.favorites.some(f => f.question === question.question && f.quizName === question.quizName);
  if (!exists) {
    progress.favorites.push({
      question: question.question,
      quizName: question.quizName,
      type: question.type,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      chapter: extractChapter(question.question)
    });
  }
  saveProgress(progress);
  return !exists;
}

function removeFavorite(questionText, quizName) {
  const progress = loadProgress();
  if (!progress.favorites) return;
  progress.favorites = progress.favorites.filter(
    f => !(f.question === questionText && f.quizName === quizName)
  );
  saveProgress(progress);
}

function isFavorited(questionText, quizName) {
  const progress = loadProgress();
  if (!progress.favorites) return false;
  return progress.favorites.some(f => f.question === questionText && f.quizName === quizName);
}

function getFavorites() {
  const progress = loadProgress();
  return progress.favorites || [];
}

function extractChapter(questionText) {
  // 从题目中提取章节标签，如"（表1-1）" -> "表1-1"
  const match = questionText.match(/（([^）]+)）$/);
  return match ? match[1] : null;
}
