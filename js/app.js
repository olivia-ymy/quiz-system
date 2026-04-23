// app.js
let currentQuiz = null;       // 当前题库完整数据
let questions = [];           // 当前题库题目数组
let currentIndex = 0;
let selectedAnswers = [];
let submitted = false;
let currentMode = 'practice';

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

const importBtn = document.createElement('button');
importBtn.id = 'btn-import-json';
importBtn.textContent = '加载题库 JSON';
importBtn.style.cssText = 'margin-top:1rem;padding:0.5rem 1rem;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;';
importBtn.addEventListener('click', () => fileInput.click());
document.getElementById('import-section').appendChild(importBtn);

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    currentQuiz = await loadQuestionsFromFile(file);
    questions = shuffleArray([...currentQuiz.questions]);
    questions.forEach((q, i) => { q.id = i; q.quizName = currentQuiz.name; });
    
    // 保存到 quiz_meta
    const metaRaw = localStorage.getItem('quiz_meta');
    let meta = metaRaw ? JSON.parse(metaRaw) : [];
    if (!meta.some(m => m.name === currentQuiz.name)) {
      meta.push({ name: currentQuiz.name, subject: currentQuiz.subject, total: questions.length });
      saveQuizMeta(meta);
    }
    
    renderQuizList();
    document.getElementById('import-section').classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');
    document.getElementById('quiz-name').textContent = currentQuiz.name;
    showQuestion(0);
  } catch (err) {
    alert('加载失败：' + err.message);
  }
});

function renderQuizList() {
  const metaRaw = localStorage.getItem('quiz_meta');
  const meta = metaRaw ? JSON.parse(metaRaw) : [];
  const list = document.getElementById('quiz-list');
  
  if (meta.length === 0) {
    list.innerHTML = '<p style="color:#888;">暂无已加载的题库，请先加载 JSON 文件</p>';
    return;
  }
  
  list.innerHTML = meta.map(m => `
    <div class="quiz-item" data-name="${m.name}">
      <div>
        <div class="quiz-item-name">${m.name}</div>
        <div class="quiz-item-info">${m.subject} · ${m.total} 题</div>
      </div>
      <button class="quiz-load-btn" data-name="${m.name}">选择</button>
    </div>
  `).join('');
  
  list.querySelectorAll('.quiz-load-btn').forEach(btn => {
    btn.style.cssText = 'padding:0.3rem 0.8rem;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = btn.dataset.name;
      // 查找本地存储的题库（通过 name 匹配）
      // 简化处理：提示用户手动加载
      alert('请通过"加载题库 JSON"按钮加载对应文件');
    });
  });
}

const questionType = document.getElementById('question-type');
const questionText = document.getElementById('question-text');
const optionsDiv = document.getElementById('options');
const btnSubmit = document.getElementById('btn-submit');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const feedback = document.getElementById('feedback');
const correctnessDiv = document.getElementById('correctness');
const explanationDiv = document.getElementById('explanation');
const barFill = document.getElementById('bar-fill');
const progressText = document.getElementById('progress-text');

function showQuestion(index) {
  if (currentMode !== 'practice' || questions.length === 0) return;
  const q = questions[index];
  currentIndex = index;
  selectedAnswers = [];
  submitted = false;

  questionType.textContent = q.type === 'single' ? '【单选题】' 
    : q.type === 'multi' ? '【多选题】' 
    : '【判断题】';
  questionText.textContent = q.question;
  
  optionsDiv.innerHTML = '';
  
  if (q.type === 'truefalse') {
    ['正确', '错误'].forEach((label, i) => {
      const id = i === 0 ? 'true' : 'false';
      const label_el = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'option';
      input.value = id;
      input.addEventListener('change', () => {
        if (!submitted) {
          selectedAnswers = [id];
          btnSubmit.disabled = false;
        }
      });
      label_el.appendChild(input);
      label_el.appendChild(document.createTextNode(' ' + label));
      optionsDiv.appendChild(label_el);
    });
  } else {
    Object.entries(q.options).forEach(([key, val]) => {
      const label = document.createElement('label');
      const inputType = q.type === 'multi' ? 'checkbox' : 'radio';
      const input = document.createElement('input');
      input.type = inputType;
      input.name = 'option';
      input.value = key;
      input.addEventListener('change', () => {
        if (!submitted) {
          if (inputType === 'checkbox') {
            selectedAnswers = [...optionsDiv.querySelectorAll('input:checked')].map(i => i.value);
            btnSubmit.disabled = selectedAnswers.length === 0;
          } else {
            selectedAnswers = [key];
            btnSubmit.disabled = false;
          }
        }
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + key + '. ' + val));
      optionsDiv.appendChild(label);
    });
  }

  const pct = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;
  barFill.style.width = pct + '%';
  progressText.textContent = `${index + 1}/${questions.length}`;

  btnSubmit.disabled = true;
  btnNext.classList.add('hidden');
  btnPrev.disabled = index === 0;
  feedback.classList.add('hidden');
}

btnSubmit.addEventListener('click', () => {
  const q = questions[currentIndex];
  submitted = true;
  const correct = checkAnswer(q, selectedAnswers);
  
  incrementAttempt(correct);
  
  feedback.classList.remove('hidden', 'wrong-answer');
  if (correct) {
    feedback.style.borderLeftColor = '#27ae60';
    correctnessDiv.textContent = '✅ 回答正确！';
  } else {
    feedback.style.borderLeftColor = '#e74c3c';
    correctnessDiv.textContent = `❌ 回答错误！正确答案：${formatAnswer(q.answer)}`;
    feedback.classList.add('wrong-answer');
    addWrongQuestion(q, selectedAnswers);
  }
  explanationDiv.textContent = q.explanation || '';
  highlightOptions(q, selectedAnswers, correct);
  btnSubmit.classList.add('hidden');
  btnNext.classList.remove('hidden');
});

btnNext.addEventListener('click', () => {
  if (currentIndex < questions.length - 1) showQuestion(currentIndex + 1);
});

btnPrev.addEventListener('click', () => {
  if (currentIndex > 0) showQuestion(currentIndex - 1);
});

function checkAnswer(q, selected) {
  if (q.type === 'single') return selected[0] === q.answer;
  if (q.type === 'multi') {
    const corr = [...q.answer].sort();
    const sel = [...selected].sort();
    return JSON.stringify(corr) === JSON.stringify(sel);
  }
  if (q.type === 'truefalse') return selected[0] === q.answer;
}

function formatAnswer(ans) {
  if (Array.isArray(ans)) return ans.join('');
  return String(ans);
}

function highlightOptions(q, selected, correct) {
  const labels = optionsDiv.querySelectorAll('label');
  labels.forEach(label => {
    const input = label.querySelector('input');
    const val = input.value;
    const isCorrect = q.type === 'multi' ? q.answer.includes(val) : q.answer === val;
    if (isCorrect) label.classList.add('correct');
    if (selected.includes(val) && !correct) label.classList.add('wrong');
  });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 导航
document.getElementById('btn-practice').addEventListener('click', () => {
  if (questions.length === 0) { alert('请先加载题库'); return; }
  switchMode('practice');
});
document.getElementById('btn-wrong').addEventListener('click', () => switchMode('wrong'));
document.getElementById('btn-stats').addEventListener('click', () => switchMode('stats'));

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('header nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + mode).classList.add('active');
  
  document.getElementById('question-area').classList.add('hidden');
  document.getElementById('wrong-area').classList.add('hidden');
  document.getElementById('stats-area').classList.add('hidden');
  
  if (mode === 'practice' && questions.length > 0) {
    document.getElementById('question-area').classList.remove('hidden');
  } else if (mode === 'wrong') {
    document.getElementById('wrong-area').classList.remove('hidden');
    renderWrongList();
  } else if (mode === 'stats') {
    document.getElementById('stats-area').classList.remove('hidden');
    renderStats();
  }
}

function renderWrongList() {
  const progress = loadProgress();
  const list = document.getElementById('wrong-list');
  document.getElementById('wrong-count').textContent = progress.wrongQuestions.length;
  
  if (progress.wrongQuestions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">暂无错题，太棒了！🎉</p>';
    return;
  }
  
  list.innerHTML = progress.wrongQuestions.map((q, i) => `
    <div class="wrong-item">
      <div class="wrong-q">${i + 1}. ${q.question}</div>
      <div class="wrong-detail">题库：${q.quizName} | 你的答案：${formatAnswer(q.yourAnswer)} | 正确答案：${formatAnswer(q.correctAnswer)}</div>
    </div>
  `).join('');
}

function renderStats() {
  const p = loadProgress();
  document.getElementById('stat-total').textContent = p.totalAttempts;
  document.getElementById('stat-correct').textContent = p.correctAttempts;
  const acc = p.totalAttempts === 0 ? 0 : Math.round(p.correctAttempts / p.totalAttempts * 100);
  document.getElementById('stat-accuracy').textContent = acc + '%';
}

document.getElementById('btn-clear-wrong').addEventListener('click', () => {
  if (confirm('确定清空错题本？')) {
    clearWrongQuestions();
    renderWrongList();
  }
});

document.getElementById('btn-export').addEventListener('click', exportProgress);

const importProgressInput = document.createElement('input');
importProgressInput.type = 'file';
importProgressInput.accept = '.json';
importProgressInput.style.display = 'none';
document.body.appendChild(importProgressInput);

document.getElementById('btn-import-progress').addEventListener('click', () => importProgressInput.click());
importProgressInput.addEventListener('change', async () => {
  const file = importProgressInput.files[0];
  if (!file) return;
  try {
    await importProgress(file);
    alert('进度导入成功！');
    renderStats();
  } catch (err) {
    alert('导入失败：' + err.message);
  }
});




renderQuizList();