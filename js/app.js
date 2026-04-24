// app.js
let currentQuiz = null;       // 当前题库完整数据
let questions = [];           // 当前题库题目数组
let currentIndex = 0;
let selectedAnswers = [];
let submitted = false;
let currentMode = 'practice';
let practiceMode = 'random'; // 'random' | 'sequential'
let wrongMode = false;       // 是否在错题练习模式
let currentWrongIndex = 0;
let sessionAnswered = 0; // 本次练习已答题数
let currentFavorites = []; // 当前收藏列表（按章节分组）

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
    
    // 默认随机模式
    practiceMode = 'random';
    document.getElementById('btn-mode-rand').style.background = '#27ae60';
    document.getElementById('btn-mode-rand').style.color = 'white';
    document.getElementById('btn-mode-seq').style.background = 'white';
    document.getElementById('btn-mode-seq').style.color = '#3498db';
    
    if (practiceMode === 'random') {
      questions = shuffleArray([...currentQuiz.questions]);
    } else {
      questions = [...currentQuiz.questions];
    }
    questions.forEach((q, i) => { q.id = i; q.quizName = currentQuiz.name; });
    sessionAnswered = 0;
    answeredText.textContent = '';
    
    // 保存到 quiz_meta（增强版）
    const meta = getQuizMeta();
    const existingIdx = meta.findIndex(m => m.name === currentQuiz.name);
    if (existingIdx >= 0) {
      meta[existingIdx] = { name: currentQuiz.name, subject: currentQuiz.subject, total: questions.length };
    } else {
      meta.push({ name: currentQuiz.name, subject: currentQuiz.subject, total: questions.length });
    }
    saveQuizMeta(meta);
    
    renderQuizList();
    renderChapterList(currentQuiz);
    document.getElementById('import-section').classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');
    document.getElementById('quiz-name').textContent = currentQuiz.name;
    showQuestion(0);
  } catch (err) {
    alert('加载失败：' + err.message);
  }
});

function getChapters(quiz) {
  const chapters = {};
  quiz.questions.forEach(q => {
    const ch = extractChapter(q.question);
    if (ch) {
      if (!chapters[ch]) chapters[ch] = [];
      chapters[ch].push(q);
    }
  });
  return chapters;
}

function renderChapterList(quiz) {
  const chapterSection = document.getElementById('chapter-section');
  const chapterList = document.getElementById('chapter-list');
  const chapters = getChapters(quiz);
  const chapterKeys = Object.keys(chapters).sort();

  if (chapterKeys.length === 0) {
    chapterSection.style.display = 'none';
    return;
  }

  chapterSection.style.display = 'block';
  chapterList.innerHTML = chapterKeys.map(ch => `
    <button class="chapter-btn" data-chapter="${ch}" style="padding:0.3rem 0.7rem;border:1px solid #9b59b6;background:white;color:#9b59b6;border-radius:20px;cursor:pointer;font-size:0.85rem;">
      ${ch} <span style="font-size:0.75rem;">(${chapters[ch].length}题)</span>
    </button>
  `).join('');

  chapterList.querySelectorAll('.chapter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ch = btn.dataset.chapter;
      startChapterPractice(chapters[ch], ch);
    });
  });
}

function startChapterPractice(chapterQuestions, chapterName) {
  currentQuiz = { name: `章节练习：${chapterName}`, subject: currentQuiz.subject, total: chapterQuestions.length };
  questions = [...chapterQuestions];
  sessionAnswered = 0;
  wrongMode = false;
  document.getElementById('question-area').classList.remove('hidden');
  document.getElementById('quiz-name').textContent = `📚 ${chapterName}`;
  showQuestion(0);
}

function renderQuizList() {
  const meta = getQuizMeta();
  const list = document.getElementById('quiz-list');
  
  if (meta.length === 0) {
    list.innerHTML = '<p style="color:#888;">暂无已加载的题库，请先加载 JSON 文件</p>';
    return;
  }
  
  list.innerHTML = meta.map(m => `
    <div class="quiz-item" data-name="${m.name}">
      <div>
        <div class="quiz-item-name">${m.name}</div>
        <div class="quiz-item-info">${m.subject || ''} · ${m.total} 题</div>
      </div>
      <button class="quiz-load-btn" data-name="${m.name}">加载</button>
    </div>
  `).join('');
  
  list.querySelectorAll('.quiz-load-btn').forEach(btn => {
    btn.style.cssText = 'padding:0.3rem 0.8rem;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
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
const answeredText = document.getElementById('answered-text');

function showQuestion(index) {
  if ((currentMode !== 'practice' || questions.length === 0) && !wrongMode) return;
  const q = questions[index];
  currentIndex = index;
  selectedAnswers = [];
  submitted = false;

  questionType.textContent = q.type === 'single' ? '【单选题】' 
    : q.type === 'multi' ? '【多选题】' 
    : '【判断题】';
  questionText.textContent = q.question;

  // 渲染收藏按钮（先清除旧的，避免重复）
  const existingBookmark = document.getElementById('btn-bookmark');
  if (existingBookmark) existingBookmark.remove();

  const bookmarkBtn = document.createElement('button');
  bookmarkBtn.id = 'btn-bookmark';
  bookmarkBtn.style.cssText = 'float:right;background:transparent;border:1px solid #ddd;color:#888;padding:0.2rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.8rem;';
  const isFav = isFavorited(q.question, q.quizName);
  bookmarkBtn.textContent = isFav ? '★ 已收藏' : '☆ 收藏';
  bookmarkBtn.onclick = () => {
    if (isFavorited(q.question, q.quizName)) {
      removeFavorite(q.question, q.quizName);
      bookmarkBtn.textContent = '☆ 收藏';
      bookmarkBtn.style.color = '#888';
    } else {
      addFavorite(q);
      bookmarkBtn.textContent = '★ 已收藏';
      bookmarkBtn.style.color = '#f39c12';
    }
  };
  if (isFav) {
    bookmarkBtn.style.color = '#f39c12';
  }
  // 插入到 question-card 的顶部
  const card = document.getElementById('question-card');
  card.insertBefore(bookmarkBtn, card.firstChild);

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
  answeredText.textContent = `已答 ${sessionAnswered} 题`;

  btnSubmit.disabled = true;
  btnSubmit.classList.remove('hidden');
  btnNext.classList.add('hidden');
  btnPrev.disabled = index === 0;
  feedback.classList.add('hidden');
}

btnSubmit.addEventListener('click', () => {
  const q = questions[currentIndex];
  submitted = true;
  sessionAnswered++;
  const correct = checkAnswer(q, selectedAnswers);
  
  incrementAttempt(correct);
  
  feedback.classList.remove('hidden', 'wrong-answer');
  if (correct) {
    feedback.style.borderLeftColor = '#27ae60';
    correctnessDiv.textContent = '✅ 回答正确！';
    if (wrongMode) {
      // 答对了，从错题本移除
      removeWrongQuestion(q.question, q.quizName);
    }
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
  if (wrongMode) {
    // 错题练习模式：答对自动移除，答错继续
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      showQuestion(currentIndex);
    } else {
      // 全部做完，返回错题本
      wrongMode = false;
      document.getElementById('question-area').classList.add('hidden');
      document.getElementById('wrong-area').classList.remove('hidden');
      renderWrongList();
    }
  } else {
    if (currentIndex < questions.length - 1) showQuestion(currentIndex + 1);
  }
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
document.getElementById('btn-wrong').addEventListener('click', () => {
  switchMode('wrong');
});
document.getElementById('btn-stats').addEventListener('click', () => switchMode('stats'));
document.getElementById('btn-fav').addEventListener('click', () => switchMode('favorites'));

function switchMode(mode) {
  currentMode = mode;
  wrongMode = false;
  document.querySelectorAll('header nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + mode).classList.add('active');
  
  document.getElementById('question-area').classList.add('hidden');
  document.getElementById('wrong-area').classList.add('hidden');
  document.getElementById('stats-area').classList.add('hidden');
  document.getElementById('favorites-area').classList.add('hidden');
  
  if (mode === 'practice' && questions.length > 0) {
    document.getElementById('question-area').classList.remove('hidden');
  } else if (mode === 'wrong') {
    wrongMode = false;
    document.getElementById('wrong-area').classList.remove('hidden');
    renderWrongList();
  } else if (mode === 'stats') {
    document.getElementById('stats-area').classList.remove('hidden');
    renderStats();
  } else if (mode === 'favorites') {
    document.getElementById('favorites-area').classList.remove('hidden');
    renderFavoritesList();
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
  
  list.innerHTML = `
    <div style="margin-bottom:1rem;">
      <button id="btn-practice-wrong" style="padding:0.5rem 1.2rem;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;font-size:1rem;">开始练习错题 (${progress.wrongQuestions.length}题)</button>
    </div>
    <div style="margin-bottom:1rem;font-size:0.85rem;color:#888;">点击"开始练习错题"将逐一练习所有错题</div>
  ` + progress.wrongQuestions.map((q, i) => `
    <div class="wrong-item" style="position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div style="flex:1;">
          <div class="wrong-q" style="font-size:0.95rem;margin-bottom:0.3rem;">${i + 1}. ${q.question}</div>
          <div class="wrong-detail" style="font-size:0.8rem;color:#888;">❌ 错 ${q.wrongCount || 1} 次 | 正确答案：${formatAnswer(q.correctAnswer)}</div>
        </div>
        <button class="btn-remove-wrong" data-index="${i}" data-question="${encodeURIComponent(q.question)}" data-quiz="${encodeURIComponent(q.quizName)}" style="padding:0.2rem 0.5rem;background:#ddd;color:#666;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;margin-left:0.5rem;">移除</button>
      </div>
    </div>
  `).join('');
  
  // 绑定开始练习错题按钮
  const practiceWrongBtn = document.getElementById('btn-practice-wrong');
  if (practiceWrongBtn) {
    practiceWrongBtn.addEventListener('click', () => {
      startWrongPractice();
    });
  }
  
  // 绑定移除按钮
  list.querySelectorAll('.btn-remove-wrong').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const question = decodeURIComponent(btn.dataset.question);
      const quizName = decodeURIComponent(btn.dataset.quizName);
      if (confirm('确定移除这道错题？')) {
        removeWrongQuestion(question, quizName);
        renderWrongList();
      }
    });
  });
}

function startWrongPractice() {
  const progress = loadProgress();
  if (progress.wrongQuestions.length === 0) {
    alert('暂无错题！');
    return;
  }
  
  // 将错题加载为题目集
  currentQuiz = { name: '错题本练习', subject: '错题', total: progress.wrongQuestions.length };
  questions = progress.wrongQuestions.map((q, i) => ({
    id: i,
    quizName: q.quizName,
    type: q.type,
    question: q.question,
    options: q.options,
    answer: q.correctAnswer,
    explanation: q.explanation
  }));
  wrongMode = true;
  sessionAnswered = 0;
  currentWrongIndex = 0;
  
  document.getElementById('wrong-area').classList.add('hidden');
  document.getElementById('question-area').classList.remove('hidden');
  document.getElementById('quiz-name').textContent = '❌ 错题本练习';
  showQuestion(0);
}

function renderStats() {
  const p = loadProgress();
  document.getElementById('stat-total').textContent = p.totalAttempts;
  document.getElementById('stat-correct').textContent = p.correctAttempts;
  const acc = p.totalAttempts === 0 ? 0 : Math.round(p.correctAttempts / p.totalAttempts * 100);
  document.getElementById('stat-accuracy').textContent = acc + '%';
}

function renderFavoritesList() {
  const favs = getFavorites();
  const list = document.getElementById('fav-list');
  document.getElementById('fav-count').textContent = favs.length;

  if (favs.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">暂无收藏题目 📝</p>';
    return;
  }

  list.innerHTML = favs.map((f, i) => `
    <div class="wrong-item" style="position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div style="flex:1;">
          <div style="font-size:0.8rem;color:#9b59b6;margin-bottom:0.3rem;">${f.chapter || '未分类'}</div>
          <div class="wrong-q" style="font-size:0.95rem;margin-bottom:0.3rem;">${i + 1}. ${f.question}</div>
          <div class="wrong-detail" style="font-size:0.8rem;color:#888;">正确答案：${formatAnswer(f.answer)}</div>
        </div>
        <button class="btn-remove-fav" data-index="${i}" style="padding:0.2rem 0.5rem;background:#ddd;color:#666;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;margin-left:0.5rem;">移除</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-remove-fav').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const fav = getFavorites()[idx];
      removeFavorite(fav.question, fav.quizName);
      renderFavoritesList();
    });
  });
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

// 模式切换逻辑
document.getElementById('btn-mode-seq').addEventListener('click', () => {
  practiceMode = 'sequential';
  document.getElementById('btn-mode-seq').style.background = '#3498db';
  document.getElementById('btn-mode-seq').style.color = 'white';
  document.getElementById('btn-mode-rand').style.background = 'white';
  document.getElementById('btn-mode-rand').style.color = '#27ae60';
  if (currentQuiz) {
    if (practiceMode === 'random') {
      questions = shuffleArray([...currentQuiz.questions]);
    } else {
      questions = [...currentQuiz.questions];
    }
    sessionAnswered = 0;
    answeredText.textContent = '';
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
    if (practiceMode === 'random') {
      questions = shuffleArray([...currentQuiz.questions]);
    } else {
      questions = [...currentQuiz.questions];
    }
    sessionAnswered = 0;
    answeredText.textContent = '';
    showQuestion(0);
  }
});

// 返回主页按钮
document.getElementById('btn-back-home').addEventListener('click', () => {
  document.getElementById('question-area').classList.add('hidden');
  document.getElementById('import-section').classList.remove('hidden');
  sessionAnswered = 0;
  answeredText.textContent = '';
});

renderQuizList();
