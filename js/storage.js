// storage.js - localStorage 读写
const STORAGE_KEY = 'quiz_progress_v2';

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {
    totalAttempts: 0,
    correctAttempts: 0,
    wrongQuestions: [],
    lastQuizName: null
  };
}

function addWrongQuestion(question, yourAnswer) {
  const progress = loadProgress();
  const exists = progress.wrongQuestions.some(q => q.id === question.id && q.quizName === question.quizName);
  if (!exists) {
    progress.wrongQuestions.push({
      id: question.id,
      quizName: question.quizName,
      question: question.question,
      yourAnswer: yourAnswer,
      correctAnswer: question.answer,
      explanation: question.explanation
    });
  }
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
