// parser.js

function loadQuestionsFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.questions || !Array.isArray(data.questions)) {
          reject(new Error('JSON 格式错误：缺少 questions 数组'));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error('JSON 解析错误：' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function loadQuizList() {
  return new Promise((resolve) => {
    // 扫描 data/ 目录下所有 questions_*.json 文件
    // 由于浏览器无法直接扫描目录，这里通过 quiz-list.json 读取
    const metaRaw = localStorage.getItem('quiz_meta');
    resolve(metaRaw ? JSON.parse(metaRaw) : []);
  });
}

function saveQuizMeta(metaArray) {
  // metaArray: [{name: "经济法_735押题", subject: "经济法", file: "questions_经济法_735押题.json", total: 300}]
  localStorage.setItem('quiz_meta', JSON.stringify(metaArray));
}
