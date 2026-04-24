// ========== 全局变量 ==========
let currentQuiz = null;
let questions = [];
let currentIndex = 0;
let selectedAnswers = [];
let submitted = false;
let currentMode = 'practice';
let practiceMode = 'random';
let wrongMode = false;
let currentWrongIndex = 0;
let sessionAnswered = 0;
let answeredText;
let barFill;
let progressText;
let optionsDiv;

// ========== 云端同步 ==========
const API_BASE = 'https://api.oyummy.top/quiz-api';

async function saveProgressCloud() {
  const progress = {
    timestamp: Date.now(),
    wrongQuestions: JSON.parse(localStorage.getItem('quiz_wrong') || '[]'),
    favorites: JSON.parse(localStorage.getItem('quiz_favorites') || '[]'),
    stats: JSON.parse(localStorage.getItem('quiz_stats') || '{"totalAttempts":0,"correctAttempts":0}'),
    answeredPerQuiz: JSON.parse(localStorage.getItem('quiz_answered') || '{}')
  };
  try {
    await fetch(API_BASE + '/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress)
    });
  } catch (e) { /* silent fail */ }
}

async function loadProgressCloud() {
  try {
    const resp = await fetch(API_BASE + '/progress');
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.found ? data.progress : null;
  } catch { return null; }
}

// ========== 应用初始化 ==========
async function initApp() {
  const cloud = await loadProgressCloud();
  if (cloud) {
    if (cloud.wrongQuestions) localStorage.setItem('quiz_wrong', JSON.stringify(cloud.wrongQuestions));
    if (cloud.favorites) localStorage.setItem('quiz_favorites', JSON.stringify(cloud.favorites));
    if (cloud.stats) localStorage.setItem('quiz_stats', JSON.stringify(cloud.stats));
    if (cloud.answeredPerQuiz) localStorage.setItem('quiz_answered', JSON.stringify(cloud.answeredPerQuiz));
  }
  renderQuizList();
  renderWrongList();
  renderStats();
  renderFavoritesList();
}

// ========== 渲染整个应用界面 ==========
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:1rem;">
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
        <button class="nav-btn" data-view="home">📝 答题</button>
        <button class="nav-btn" data-view="stats">📊 统计</button>
        <button class="nav-btn" data-view="wrong">❌ 错题本</button>
        <button class="nav-btn" data-view="favorites">⭐ 收藏</button>
      </div>

      <div id="view-home">
        <div style="margin-bottom:1rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
          <h2 style="margin:0;">选择题库</h2>
          <button id="btn-upload" style="padding:0.35rem 0.8rem;background:#27ae60;color:white;border:1px solid #27ae60;border-radius:6px;cursor:pointer;font-size:0.85rem;">+ 上传题库</button>
        </div>
        <div id="quiz-list"></div>
        <div style="margin-top:1rem;display:flex;gap:0.5rem;align-items:center;">
          <span style="font-size:0.9rem;color:#666;">练习模式：</span>
          <button id="btn-mode-seq" style="padding:0.3rem 0.8rem;border:1px solid #3498db;background:white;color:#3498db;border-radius:4px;cursor:pointer;">顺序练习</button>
          <button id="btn-mode-rand" style="padding:0.3rem 0.8rem;border:1px solid #27ae60;background:#27ae60;color:white;border-radius:4px;cursor:pointer;">随机练习</button>
        </div>
      </div>

      <div id="view-stats" class="hidden"></div>
      <div id="view-wrong" class="hidden"></div>
      <div id="view-favorites" class="hidden"></div>

      <main id="question-area" class="hidden">
        <div style="text-align:center;margin-bottom:0.5rem;">
          <button id="btn-back-home" style="padding:0.3rem 0.8rem;background:#ddd;border:1px solid #ccc;color:#666;border-radius:4px;cursor:pointer;font-size:0.85rem;">← 返回主页</button>
        </div>
        <div id="quiz-name" style="text-align:center;color:#666;font-size:0.9rem;margin-bottom:0.5rem;"></div>
        <div id="progress-bar">
          <span id="progress-text">1/100</span>
          <span id="answered-text" style="float:right;color:#888;font-size:0.85rem;"></span>
          <div id="bar-fill"></div>
        </div>
        <div id="question-text" style="font-size:1.1rem;margin:1rem 0;line-height:1.6;"></div>
        <div id="options-container"></div>
        <div id="answer-result" style="margin-top:1rem;font-weight:bold;"></div>
        <div id="explanation" style="margin-top:1rem;padding:0.8rem;background:#f8f9fa;border-radius:8px;display:none;"></div>
        <div id="action-buttons" style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button id="btn-submit" style="padding:0.6rem 1.5rem;background:#3498db;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">提交答案</button>
          <button id="btn-next" style="padding:0.6rem 1.5rem;background:#27ae60;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;display:none;">下一题 →</button>
          <button id="btn-finish" style="padding:0.6rem 1.5rem;background:#9b59b6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;display:none;">🏁 查看结果</button>
        </div>
      </main>
    </div>
  `;

  // 懒获取元素
  answeredText = document.getElementById('answered-text');
  barFill = document.getElementById('bar-fill');
  progressText = document.getElementById('progress-text');
  optionsDiv = document.getElementById('options-container');

  // 绑定事件
  document.getElementById('btn-upload').addEventListener('click', uploadQuizFile);
  document.getElementById('btn-back-home').addEventListener('click', () => {
    document.getElementById('question-area').classList.add('hidden');
    document.getElementById('view-home').classList.remove('hidden');
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  document.getElementById('btn-mode-seq').addEventListener('click', () => {
    practiceMode = 'sequential';
    document.getElementById('btn-mode-seq').style.background = '#3498db';
    document.getElementById('btn-mode-seq').style.color = 'white';
    document.getElementById('btn-mode-rand').style.background = 'white';
    document.getElementById('btn-mode-rand').style.color = '#27ae60';
    if (currentQuiz) {
      questions = [...currentQuiz.questions];
      sessionAnswered = 0;
      showQuestion(0);
    }
  });
  document.getElementById('btn-mode-rand').addEventListener('click', () => {
    practiceMode = 'random';
    document.getElementById('btn-mode-rand').style.background = '#27ae60';
    document.getElementById('btn-mode-rand').style.color = 'white';
    document.getElementById('btn-mode-seq').style.background = 'white';
    document.getElementById('btn-mode-seq').style.color = '#3498db';
    if (currentQuiz) {
      questions = shuffleArray([...currentQuiz.questions]);
      sessionAnswered = 0;
      showQuestion(0);
    }
  });

  // 提交/下一题/完成
  document.getElementById('btn-submit').addEventListener('click', submitAnswer);
  document.getElementById('btn-next').addEventListener('click', () => showQuestion(currentIndex + 1));
  document.getElementById('btn-finish').addEventListener('click', showFinalResult);

  initApp();
}

// ========== 视图导航 ==========
function showView(view) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.dataset.view === view) {
      btn.style.background = '#667eea';
      btn.style.color = 'white';
      btn.style.borderColor = '#667eea';
    } else {
      btn.style.background = 'white';
      btn.style.color = '#666';
      btn.style.borderColor = '#e0e0e0';
    }
  });

  ['home','stats','wrong','favorites'].forEach(v => {
    document.getElementById('view-' + v).classList.add('hidden');
  });

  if (view === 'stats') {
    document.getElementById('view-stats').classList.remove('hidden');
    renderStats();
  } else if (view === 'wrong') {
    document.getElementById('view-wrong').classList.remove('hidden');
    renderWrongList();
  } else if (view === 'favorites') {
    document.getElementById('view-favorites').classList.remove('hidden');
    renderFavoritesList();
  } else {
    document.getElementById('view-home').classList.remove('hidden');
  }
}

// ========== 上传题库 ==========
function uploadQuizFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const quiz = JSON.parse(text);
      if (!quiz.name || !quiz.questions || !Array.isArray(quiz.questions)) {
        alert('题库格式错误，需要包含 name 和 questions 字段');
        return;
      }
      const list = JSON.parse(localStorage.getItem('quiz_list') || '[]');
      const existing = list.findIndex(q => q.name === quiz.name);
      if (existing >= 0) list[existing] = { name: quiz.name, total: quiz.questions.length };
      else list.push({ name: quiz.name, total: quiz.questions.length });
      localStorage.setItem('quiz_list', JSON.stringify(list));
      localStorage.setItem('quiz_' + quiz.name, JSON.stringify(quiz));
      renderQuizList();
      alert('题库「' + quiz.name + '」上传成功，共 ' + quiz.questions.length + ' 题');
    } catch (err) {
      alert('文件解析失败：' + err.message);
    }
  };
  input.click();
}

// ========== 渲染题库列表 ==========
function renderQuizList() {
  const listEl = document.getElementById('quiz-list');
  if (!listEl) return;
  const list = JSON.parse(localStorage.getItem('quiz_list') || '[]');
  if (list.length === 0) {
    listEl.innerHTML = '<p style="color:#888;">暂无题库，请点击「+ 上传题库」导入 JSON 文件</p>';
    return;
  }
  listEl.innerHTML = list.map(q => `
    <div class="quiz-card" style="border:1px solid #e0e0e0;border-radius:8px;padding:1rem;margin-bottom:0.5rem;cursor:pointer;" onclick="startQuiz('${q.name.replace(/'/g, "\\'")}')">
      <div style="font-weight:bold;color:#333;">${q.name}</div>
      <div style="font-size:0.85rem;color:#888;margin-top:0.3rem;">${q.total} 题</div>
    </div>
  `).join('');
}

// ========== 开始答题 ==========
function startQuiz(name) {
  const data = localStorage.getItem('quiz_' + name);
  if (!data) { alert('题库未找到'); return; }
  currentQuiz = JSON.parse(data);
  questions = practiceMode === 'random' ? shuffleArray([...currentQuiz.questions]) : [...currentQuiz.questions];
  currentIndex = 0;
  sessionAnswered = 0;
  wrongMode = false;
  document.getElementById('view-home').classList.add('hidden');
  document.getElementById('question-area').classList.remove('hidden');
  document.getElementById('quiz-name').textContent = currentQuiz.name;
  showQuestion(0);
}

// ========== 显示题目 ==========
function showQuestion(index) {
  if (wrongMode) {
    const wrongList = JSON.parse(localStorage.getItem('quiz_wrong') || '[]');
    if (index >= wrongList.length) { showFinalResult(); return; }
    currentQuiz = { name: wrongList[index].quizName, questions: wrongList };
    questions = wrongList;
    currentIndex = index;
  }

  const q = questions[index];
  if (!q) { showFinalResult(); return; }

  submitted = false;
  selectedAnswers = [];
  document.getElementById('question-area').classList.remove('hidden');
  document.getElementById('answer-result').textContent = '';
  document.getElementById('answer-result').style.color = '';
  document.getElementById('explanation').style.display = 'none';
  document.getElementById('btn-submit').style.display = '';
  document.getElementById('btn-next').style.display = 'none';
  document.getElementById('btn-finish').style.display = 'none';

  // 进度
  progressText.textContent = `${index + 1}/${questions.length}`;
  barFill.style.width = `${((index + 1) / questions.length) * 100}%`;
  if (wrongMode) {
    answeredText.textContent = `本次已答 ${sessionAnswered} 题`;
  } else {
    const quizKey = questions[currentIndex] ? questions[currentIndex].quizName : null;
    const quizAnswered = quizKey ? getAnsweredIds(quizKey).length : 0;
    const totalQ = currentQuiz && currentQuiz.questions ? currentQuiz.questions.length : questions.length;
    answeredText.textContent = `已做 ${quizAnswered} 题 / 共 ${totalQ} 题`;
  }

  // 题目
  const q = questions[index];
  let typeLabel = '';
  if (q.type === 'truefalse') typeLabel = '【判断题】';
  else if (q.type === 'multiple') typeLabel = '【多选题】可多选';
  else typeLabel = '【单选题】';

  document.getElementById('question-text').innerHTML =
    '<span style="background:#667eea;color:white;padding:2px 8px;border-radius:4px;font-size:0.85rem;margin-right:6px;">' + typeLabel + '</span>' + (index + 1) + '. ' + q.question;

  // 选项
  const isMulti = q.type === 'multiple';
  optionsDiv.innerHTML = '';
  if (!q.options || typeof q.options !== 'object') {
    optionsDiv.innerHTML = '<p style="color:#e74c3c;">题目选项数据缺失</p>';
    return;
  }
  if (q.type === 'truefalse') {
    ['对', '错'].forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = label;
      btn.style.cssText = 'display:block;width:100%;padding:0.7rem;margin:0.4rem 0;border:2px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:1rem;text-align:left;';
      btn.onclick = () => handleOptionClick(label, btn);
      optionsDiv.appendChild(btn);
    });
  } else {
    Object.entries(q.options).forEach(([key, val]) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.key = key;
      btn.innerHTML = '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;border:2px solid #667eea;margin-right:10px;font-weight:bold;color:#667eea;">' + key + '</span>' + val + (isMulti ? '' : '');
      btn.style.cssText = 'display:flex;align-items:center;width:100%;padding:0.7rem;margin:0.4rem 0;border:2px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:1rem;text-align:left;';
      btn.onclick = () => handleOptionClick(key, btn);
      optionsDiv.appendChild(btn);
    });
  }

  // 收藏按钮
  const existingBookmark = document.getElementById('btn-bookmark');
  if (existingBookmark) existingBookmark.remove();
  const bookmarkBtn = document.createElement('button');
  bookmarkBtn.id = 'btn-bookmark';
  const isFav = isQuestionFavorited(q.question, q.quizName);
  bookmarkBtn.textContent = isFav ? '★ 已收藏' : '☆ 收藏';
  bookmarkBtn.style.cssText = 'padding:0.4rem 0.8rem;border:1px solid #f39c12;background:white;color:' + (isFav ? '#f39c12' : '#888') + ';border-radius:6px;cursor:pointer;margin-top:0.5rem;';
  bookmarkBtn.onclick = () => {
    if (isQuestionFavorited(q.question, q.quizName)) {
      removeFavorite(q.question, q.quizName);
      bookmarkBtn.textContent = '☆ 收藏';
      bookmarkBtn.style.color = '#888';
    } else {
      addFavorite(q);
      bookmarkBtn.textContent = '★ 已收藏';
      bookmarkBtn.style.color = '#f39c12';
    }
    saveProgressCloud();
  };
  optionsDiv.appendChild(bookmarkBtn);
}

// ========== 选择选项 ==========
function handleOptionClick(key, btn) {
  if (submitted) return;
  const q = questions[currentIndex];
  if (q.type === 'truefalse') {
    selectedAnswers = [key];
    document.querySelectorAll('.option-btn').forEach(b => { b.style.background = 'white'; b.style.borderColor = '#ddd'; });
    btn.style.background = '#e8f0fe';
    btn.style.borderColor = '#667eea';
  } else {
    const isMulti = q.type === 'multiple';
    if (isMulti) {
      if (selectedAnswers.includes(key)) {
        selectedAnswers = selectedAnswers.filter(a => a !== key);
        btn.style.background = 'white';
        btn.style.borderColor = '#ddd';
      } else {
        selectedAnswers.push(key);
        btn.style.background = '#e8f0fe';
        btn.style.borderColor = '#667eea';
      }
    } else {
      selectedAnswers = [key];
      document.querySelectorAll('.option-btn').forEach(b => { b.style.background = 'white'; b.style.borderColor = '#ddd'; });
      btn.style.background = '#e8f0fe';
      btn.style.borderColor = '#667eea';
    }
  }
}

// ========== 提交答案 ==========
function submitAnswer() {
  if (submitted) return;
  const q = questions[currentIndex];
  if (selectedAnswers.length === 0) { alert('请先选择答案'); return; }
  submitted = true;
  sessionAnswered++;
  markAnswered(questions[currentIndex].quizName, questions[currentIndex].question);
  const correct = checkAnswer(q, selectedAnswers);
  document.getElementById('btn-submit').style.display = 'none';
  const isLast = currentIndex >= questions.length - 1;
  if (isLast) document.getElementById('btn-finish').style.display = '';
  else document.getElementById('btn-next').style.display = '';
  document.getElementById('explanation').style.display = '';
  document.getElementById('explanation').textContent = q.explanation || '';
  if (!correct) addWrongQuestion(q, selectedAnswers);
  saveProgressCloud();
  highlightOptions(q, selectedAnswers, correct);
}

// ========== 检查答案 ==========
function checkAnswer(q, selected) {
  const correct = Array.isArray(q.answer) ? q.answer : [q.answer];
  incrementAttempt(correct.some(a => selected.includes(a)));
  const isCorrect = correct.length === selected.length && correct.every(a => selected.includes(a));
  const resultEl = document.getElementById('answer-result');
  resultEl.textContent = isCorrect ? '✅ 回答正确！' : '❌ 回答错误';
  resultEl.style.color = isCorrect ? '#27ae60' : '#e74c3c';
  return isCorrect;
}

function highlightOptions(q, selected, correct) {
  const correctArr = Array.isArray(q.answer) ? q.answer : [q.answer];
  document.querySelectorAll('.option-btn').forEach(btn => {
    const key = btn.dataset.key;
    if (!key) return;
    if (correctArr.includes(key)) {
      btn.style.background = '#d4edda';
      btn.style.borderColor = '#27ae60';
    } else if (selected.includes(key)) {
      btn.style.background = '#f8d7da';
      btn.style.borderColor = '#e74c3c';
    }
  });
}

// ========== 显示最终结果 ==========
function showFinalResult() {
  const total = questions.length;
  const correct = selectedAnswers.length > 0 && checkAnswer(questions[currentIndex], selectedAnswers);
  const wrong = total - (correct ? 1 : 0);
  document.getElementById('question-text').textContent = '练习完成！';
  optionsDiv.innerHTML = '<p style="font-size:1.2rem;">共 ' + total + ' 题</p>';
  document.getElementById('answer-result').textContent = '';
  document.getElementById('btn-submit').style.display = 'none';
  document.getElementById('btn-next').style.display = 'none';
  document.getElementById('btn-finish').style.display = 'none';
  document.getElementById('explanation').style.display = 'none';
}

// ========== 渲染统计 ==========
function renderStats() {
  const el = document.getElementById('view-stats');
  if (!el) return;
  const stats = JSON.parse(localStorage.getItem('quiz_stats') || '{"totalAttempts":0,"correctAttempts":0}');
  const rate = stats.totalAttempts > 0 ? ((stats.correctAttempts / stats.totalAttempts) * 100).toFixed(1) : 0;
  el.innerHTML = `
    <h3>📊 学习统计</h3>
    <p>总答题数：<b>${stats.totalAttempts}</b></p>
    <p>正确数：<b style="color:#27ae60">${stats.correctAttempts}</b></p>
    <p>正确率：<b>${rate}%</b></p>
    <button onclick="localStorage.removeItem('quiz_stats');renderStats();" style="margin-top:1rem;padding:0.4rem 0.8rem;border:1px solid #e74c3c;background:white;color:#e74c3c;border-radius:6px;cursor:pointer;">重置统计</button>
  `;
}

// ========== 渲染错题本 ==========
function renderWrongList() {
  const el = document.getElementById('view-wrong');
  if (!el) return;
  const wrong = JSON.parse(localStorage.getItem('quiz_wrong') || '[]');
  if (wrong.length === 0) {
    el.innerHTML = '<p style="color:#888;">暂无错题，坚持就是胜利！</p>';
    return;
  }
  el.innerHTML = '<h3>❌ 错题本 (' + wrong.length + ')</h3>' + wrong.map((q, i) => `
    <div style="border:1px solid #e0e0e0;border-radius:8px;padding:0.8rem;margin:0.5rem 0;">
      <div style="font-size:0.9rem;color:#333;">${i + 1}. ${q.question}</div>
      <div style="font-size:0.8rem;color:#888;margin-top:0.3rem;">你的答案：${(q.yourAnswer || []).join(', ')} | 正确答案：${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
      <button onclick="removeWrong('${q.question.replace(/'/g, "\\'")}','${q.quizName.replace(/'/g, "\\'")}')" style="margin-top:0.3rem;padding:0.2rem 0.5rem;border:1px solid #e0e0e0;background:white;border-radius:4px;cursor:pointer;font-size:0.8rem;">移除</button>
    </div>
  `).join('') + '<button onclick="startWrongPractice()" style="margin-top:1rem;padding:0.5rem 1rem;background:#9b59b6;color:white;border:none;border-radius:8px;cursor:pointer;">🔁 重新练习错题</button>';
}

// ========== 渲染收藏 ==========
function renderFavoritesList() {
  const el = document.getElementById('view-favorites');
  if (!el) return;
  const favs = JSON.parse(localStorage.getItem('quiz_favorites') || '[]');
  if (favs.length === 0) {
    el.innerHTML = '<p style="color:#888;">暂无收藏</p>';
    return;
  }
  el.innerHTML = '<h3>⭐ 收藏夹 (' + favs.length + ')</h3>' + favs.map((f, i) => `
    <div style="border:1px solid #f39c12;border-radius:8px;padding:0.8rem;margin:0.5rem 0;">
      <div style="font-size:0.9rem;color:#333;">${i + 1}. ${f.question}</div>
      <div style="font-size:0.8rem;color:#888;margin-top:0.3rem;">${f.quizName || ''} | ${f.type === 'truefalse' ? '判断' : f.type === 'multiple' ? '多选' : '单选'}</div>
    </div>
  `).join('');
}

// ========== 错题练习 ==========
function startWrongPractice() {
  const wrong = JSON.parse(localStorage.getItem('quiz_wrong') || '[]');
  if (wrong.length === 0) { alert('暂无错题'); return; }
  wrongMode = true;
  questions = [...wrong];
  sessionAnswered = 0;
  currentIndex = 0;
  document.getElementById('view-wrong').classList.add('hidden');
  document.getElementById('question-area').classList.remove('hidden');
  document.getElementById('quiz-name').textContent = '❌ 错题练习';
  showQuestion(0);
}

function removeWrong(question, quizName) {
  removeWrongQuestion(question, quizName);
  renderWrongList();
  saveProgressCloud();
}

// 等待 DOM 就绪后再启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
