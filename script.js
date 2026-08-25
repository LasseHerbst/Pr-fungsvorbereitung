// ==================== STATE ====================
let questions = [];
let quizQueue = [];
let currentQuestionIndex = 0;
let score = 0;
let categories = [];
let quizAnswerResults = [];

// ==================== DOM ELEMENTS ====================
const btnEditor = document.getElementById('btn-editor');
const btnQuiz = document.getElementById('btn-quiz');
const btnStats = document.getElementById('btn-stats');
const editorSection = document.getElementById('editor-section');
const quizSection = document.getElementById('quiz-section');
const statsSection = document.getElementById('stats-section');

const questionForm = document.getElementById('question-form');
const questionText = document.getElementById('question-text');
const questionCategory = document.getElementById('question-category');
const categorySuggestions = document.getElementById('category-suggestions');
const questionImage = document.getElementById('question-image');
const imagePreview = document.getElementById('image-preview');
const answersContainer = document.getElementById('answers-container');
const addAnswerBtn = document.getElementById('add-answer');
const clearFormBtn = document.getElementById('clear-form');
const questionsList = document.getElementById('questions-list');
const filterCategory = document.getElementById('filter-category');
const quizCategoryFilter = document.getElementById('quiz-category-filter');
const quizModeFilter = document.getElementById('quiz-mode-filter');

const quizStart = document.getElementById('quiz-start');
const quizActive = document.getElementById('quiz-active');
const quizEnd = document.getElementById('quiz-end');
const startQuizBtn = document.getElementById('start-quiz');
const quitQuizBtn = document.getElementById('quit-quiz');
const restartQuizBtn = document.getElementById('restart-quiz');
const quizProgress = document.getElementById('quiz-progress');
const quizCategoryBadge = document.getElementById('quiz-category-badge');
const quizQuestionText = document.getElementById('quiz-question-text');
const quizQuestionImage = document.getElementById('quiz-question-image');
const quizAnswers = document.getElementById('quiz-answers');
const quizFeedback = document.getElementById('quiz-feedback');
const nextQuestionBtn = document.getElementById('next-question');
const quizResult = document.getElementById('quiz-result');
const quizCategoryResult = document.getElementById('quiz-category-result');

const themeToggle = document.getElementById('theme-toggle');
const statTotalQuestions = document.getElementById('stat-total-questions');
const statTotalAnswered = document.getElementById('stat-total-answered');
const statCorrect = document.getElementById('stat-correct');
const statWrong = document.getElementById('stat-wrong');
const statAccuracy = document.getElementById('stat-accuracy');
const weakQuestionsList = document.getElementById('weak-questions-list');
const categoryStatsList = document.getElementById('category-stats-list');
const allQuestionsStats = document.getElementById('all-questions-stats');
const statsFilterCategory = document.getElementById('stats-filter-category');
const statsFilterPerformance = document.getElementById('stats-filter-performance');
const resetStatsBtn = document.getElementById('reset-stats');

// ==================== INIT ====================
loadQuestions();
migrateQuestions();
extractCategories();
renderQuestionsList();
renderCategoryFilters();
renderCategorySuggestions();
loadTheme();

// ==================== THEME TOGGLE ====================
themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  themeToggle.querySelector('.theme-icon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
});

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.querySelector('.theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// ==================== NAVIGATION ====================
function showSection(section) {
  editorSection.style.display = section === 'editor' ? 'block' : 'none';
  quizSection.style.display = section === 'quiz' ? 'block' : 'none';
  statsSection.style.display = section === 'stats' ? 'block' : 'none';

  btnEditor.classList.toggle('active', section === 'editor');
  btnQuiz.classList.toggle('active', section === 'quiz');
  btnStats.classList.toggle('active', section === 'stats');
}

btnEditor.addEventListener('click', () => showSection('editor'));

btnQuiz.addEventListener('click', () => {
  showSection('quiz');
  showQuizStart();
});

btnStats.addEventListener('click', () => {
  showSection('stats');
  renderStatistics();
});

// ==================== EDITOR: BILD-PREVIEW ====================
questionImage.addEventListener('change', (e) => {
  const file = e.target.files[0];
  imagePreview.innerHTML = '';
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.src = event.target.result;
      imagePreview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
});

// ==================== EDITOR: KATEGORIEN ====================
function extractCategories() {
  const categorySet = new Set();
  questions.forEach(q => {
    if (q.category && q.category.trim()) {
      categorySet.add(q.category.trim());
    }
  });
  categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'de'));
}

function renderCategorySuggestions() {
  categorySuggestions.innerHTML = '';
  if (categories.length === 0) return;

  categories.forEach(cat => {
    const suggestion = document.createElement('span');
    suggestion.className = 'category-suggestion';
    suggestion.textContent = cat;
    suggestion.addEventListener('click', () => {
      questionCategory.value = cat;
    });
    categorySuggestions.appendChild(suggestion);
  });
}

function renderCategoryFilters() {
  const previousEditorFilter = filterCategory.value;
  const previousQuizFilter = quizCategoryFilter.value;
  const previousStatsFilter = statsFilterCategory.value;
  const options = '<option value="">Alle Kategorien</option>' +
    categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');

  filterCategory.innerHTML = options;
  quizCategoryFilter.innerHTML = options;
  statsFilterCategory.innerHTML = options;

  filterCategory.value = categories.includes(previousEditorFilter) ? previousEditorFilter : '';
  quizCategoryFilter.value = categories.includes(previousQuizFilter) ? previousQuizFilter : '';
  statsFilterCategory.value = categories.includes(previousStatsFilter) ? previousStatsFilter : '';
}

// ==================== EDITOR: ANTWORTEN HINZUFÜGEN/ENTFERNEN ====================
addAnswerBtn.addEventListener('click', () => {
  const count = answersContainer.querySelectorAll('.answer-row').length;
  const row = document.createElement('div');
  row.className = 'answer-row';
  row.innerHTML = `
    <input type="text" class="answer-input" placeholder="Antwort ${count + 1}" required />
    <label><input type="radio" name="correct-answer" value="${count}" /> richtig</label>
    <button type="button" class="remove-answer">&times;</button>
  `;
  answersContainer.appendChild(row);
  updateRemoveButtons();
});

function updateRemoveButtons() {
  const rows = answersContainer.querySelectorAll('.answer-row');
  rows.forEach((row) => {
    row.querySelector('.remove-answer').disabled = rows.length <= 2;
  });
}

answersContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-answer')) {
    const row = e.target.closest('.answer-row');
    if (answersContainer.querySelectorAll('.answer-row').length > 2) {
      row.remove();
      reindexAnswers();
    }
  }
});

function reindexAnswers() {
  const rows = answersContainer.querySelectorAll('.answer-row');
  let selectedIndex = 0;

  rows.forEach((row, idx) => {
    const radio = row.querySelector('input[type="radio"]');
    if (radio.checked) selectedIndex = idx;
  });

  rows.forEach((row, idx) => {
    row.querySelector('.answer-input').placeholder = `Antwort ${idx + 1}`;
    const radio = row.querySelector('input[type="radio"]');
    radio.value = idx;
    radio.checked = idx === selectedIndex;
  });
}

// ==================== EDITOR: FRAGE SPEICHERN ====================
questionForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const answers = [];
  let correctIndex = 0;
  const rows = answersContainer.querySelectorAll('.answer-row');

  rows.forEach((row) => {
    const text = row.querySelector('.answer-input').value.trim();
    if (!text) return;

    answers.push(text);
    if (row.querySelector('input[type="radio"]').checked) {
      correctIndex = answers.length - 1;
    }
  });

  const questionData = {
    id: Date.now(),
    text: questionText.value.trim(),
    category: questionCategory.value.trim() || null,
    image: imagePreview.querySelector('img')?.src || null,
    answers,
    correctIndex,
    stats: { correct: 0, wrong: 0 }
  };

  questions.push(questionData);
  saveQuestions();
  extractCategories();
  renderCategoryFilters();
  renderCategorySuggestions();
  renderQuestionsList();
  questionForm.reset();
  imagePreview.innerHTML = '';
  resetAnswersToDefault();
});

function resetAnswersToDefault() {
  answersContainer.innerHTML = `
    <div class="answer-row">
      <input type="text" class="answer-input" placeholder="Antwort 1" required />
      <label><input type="radio" name="correct-answer" value="0" checked /> richtig</label>
      <button type="button" class="remove-answer" disabled>&times;</button>
    </div>
    <div class="answer-row">
      <input type="text" class="answer-input" placeholder="Antwort 2" required />
      <label><input type="radio" name="correct-answer" value="1" /> richtig</label>
      <button type="button" class="remove-answer">&times;</button>
    </div>
  `;
  updateRemoveButtons();
}

clearFormBtn.addEventListener('click', () => {
  questionForm.reset();
  imagePreview.innerHTML = '';
  resetAnswersToDefault();
});

// ==================== EDITOR: FRAGEN LISTE ====================
filterCategory.addEventListener('change', renderQuestionsList);

function renderQuestionsList() {
  questionsList.innerHTML = '';
  const selectedCategory = filterCategory.value;
  const filteredQuestions = selectedCategory
    ? questions.filter(q => q.category === selectedCategory)
    : questions;

  if (filteredQuestions.length === 0) {
    const message = questions.length === 0
      ? 'Noch keine Fragen gespeichert.'
      : 'Keine Fragen in dieser Kategorie.';
    questionsList.innerHTML = `<p style="color:var(--text-secondary);">${message}</p>`;
    return;
  }

  filteredQuestions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';

    let html = '<div class="question-card-header">';
    html += `<strong>Frage ${idx + 1}:</strong>`;
    if (q.category) html += `<span class="category-badge">${escapeHtml(q.category)}</span>`;
    html += '</div>';
    html += escapeHtml(q.text);

    if (q.image) html += `<img src="${q.image}" alt="Fragebild" />`;

    html += '<ul>';
    q.answers.forEach((answer, answerIndex) => {
      const marker = answerIndex === q.correctIndex ? '●' : '○';
      html += `<li>${marker} ${escapeHtml(answer)}</li>`;
    });
    html += '</ul>';
    html += `<button class="delete-question" data-id="${q.id}">Frage löschen</button>`;

    card.innerHTML = html;
    questionsList.appendChild(card);
  });

  questionsList.querySelectorAll('.delete-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      questions = questions.filter(q => q.id !== id);
      saveQuestions();
      extractCategories();
      renderCategoryFilters();
      renderCategorySuggestions();
      renderQuestionsList();
    });
  });
}

// ==================== LOCAL STORAGE ====================
function saveQuestions() {
  localStorage.setItem('pruefungsfragen', JSON.stringify(questions));
}

function loadQuestions() {
  const raw = localStorage.getItem('pruefungsfragen');
  if (!raw) return;

  try {
    questions = JSON.parse(raw);
  } catch {
    questions = [];
  }
}

function migrateQuestions() {
  let changed = false;

  questions.forEach(q => {
    if (!q.stats || typeof q.stats.correct !== 'number' || typeof q.stats.wrong !== 'number') {
      q.stats = { correct: 0, wrong: 0 };
      changed = true;
    }
  });

  if (changed) saveQuestions();
}

// ==================== QUIZ: START / SCHWACHE FRAGEN ====================
startQuizBtn.addEventListener('click', () => startQuiz());
restartQuizBtn.addEventListener('click', () => startQuiz());

function startQuiz() {
  if (questions.length === 0) {
    alert('Bitte erst mindestens eine Frage im Editor anlegen.');
    return;
  }

  const selectedCategory = quizCategoryFilter.value;
  const quizMode = quizModeFilter.value;
  let selectedQuestions = selectedCategory
    ? questions.filter(q => q.category === selectedCategory)
    : [...questions];

  if (selectedQuestions.length === 0) {
    alert('Keine Fragen in dieser Kategorie vorhanden.');
    return;
  }

  if (quizMode === 'weak') {
    selectedQuestions = createWeakQuestionQueue(selectedQuestions);
  }

  quizQueue = shuffleArray(selectedQuestions);
  currentQuestionIndex = 0;
  score = 0;
  quizAnswerResults = [];
  showQuizActive();
  showQuestion();
}

function createWeakQuestionQueue(sourceQuestions) {
  const weightedQueue = [];

  sourceQuestions.forEach(question => {
    const { correct, wrong } = question.stats;
    const answered = correct + wrong;
    const accuracy = answered === 0 ? 0 : correct / answered;

    // Neue und häufig falsche Fragen erhalten mehr Plätze in der Quiz-Warteschlange.
    let repetitions = 1;
    if (answered === 0) repetitions = 2;
    else if (accuracy < 0.4) repetitions = 4;
    else if (accuracy < 0.7) repetitions = 3;
    else if (accuracy < 0.9) repetitions = 2;

    for (let i = 0; i < repetitions; i++) {
      weightedQueue.push(question);
    }
  });

  return weightedQueue;
}

function shuffleArray(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showQuizStart() {
  quizStart.style.display = 'block';
  quizActive.style.display = 'none';
  quizEnd.style.display = 'none';
}

function showQuizActive() {
  quizStart.style.display = 'none';
  quizActive.style.display = 'block';
  quizEnd.style.display = 'none';
}

function showQuizEnd() {
  quizStart.style.display = 'none';
  quizActive.style.display = 'none';
  quizEnd.style.display = 'block';

  quizResult.textContent = `Du hast ${score} von ${quizQueue.length} Quizrunden richtig beantwortet.`;
  renderQuizCategoryResult();
}

quitQuizBtn.addEventListener('click', showQuizStart);

// ==================== QUIZ: FRAGE ANZEIGEN ====================
function showQuestion() {
  const question = quizQueue[currentQuestionIndex];
  quizProgress.textContent = `Frage ${currentQuestionIndex + 1} von ${quizQueue.length}`;
  quizCategoryBadge.textContent = question.category || '';
  quizQuestionText.textContent = question.text;

  if (question.image) {
    quizQuestionImage.src = question.image;
    quizQuestionImage.style.display = 'block';
  } else {
    quizQuestionImage.style.display = 'none';
  }

  quizAnswers.innerHTML = '';
  quizFeedback.className = 'quiz-feedback';
  quizFeedback.style.display = 'none';
  nextQuestionBtn.style.display = 'none';

  question.answers.forEach((answer, answerIndex) => {
    const button = document.createElement('button');
    button.className = 'quiz-answer-btn';
    button.textContent = answer;
    button.addEventListener('click', () => handleAnswer(answerIndex, button));
    quizAnswers.appendChild(button);
  });
}

// ==================== QUIZ: ANTWORT PRÜFEN ====================
function handleAnswer(selectedIndex, selectedButton) {
  const question = quizQueue[currentQuestionIndex];
  const answerButtons = quizAnswers.querySelectorAll('.quiz-answer-btn');
  answerButtons.forEach(button => button.disabled = true);

  const isCorrect = selectedIndex === question.correctIndex;
  question.stats = question.stats || { correct: 0, wrong: 0 };

  if (isCorrect) {
    selectedButton.classList.add('correct');
    quizFeedback.textContent = 'Richtig! 🎉';
    quizFeedback.className = 'quiz-feedback show correct';
    score++;
    question.stats.correct++;
  } else {
    selectedButton.classList.add('wrong');
    answerButtons[question.correctIndex].classList.add('correct');
    quizFeedback.textContent = 'Leider falsch. Die richtige Antwort ist markiert.';
    quizFeedback.className = 'quiz-feedback show wrong';
    question.stats.wrong++;
  }

  quizAnswerResults.push({
    category: question.category || 'Ohne Kategorie',
    correct: isCorrect
  });

  saveQuestions();
  nextQuestionBtn.style.display = 'inline-block';
}

nextQuestionBtn.addEventListener('click', () => {
  currentQuestionIndex++;
  if (currentQuestionIndex >= quizQueue.length) {
    showQuizEnd();
  } else {
    showQuestion();
  }
});

function renderQuizCategoryResult() {
  const categoryStats = {};

  quizAnswerResults.forEach(result => {
    if (!categoryStats[result.category]) {
      categoryStats[result.category] = { total: 0, correct: 0 };
    }
    categoryStats[result.category].total++;
    if (result.correct) categoryStats[result.category].correct++;
  });

  if (Object.keys(categoryStats).length === 0) {
    quizCategoryResult.innerHTML = '';
    return;
  }

  let html = '<h4>Ergebnis nach Kategorien:</h4><ul>';
  Object.entries(categoryStats).forEach(([category, stats]) => {
    html += `<li>${escapeHtml(category)}: ${stats.correct}/${stats.total} richtig</li>`;
  });
  html += '</ul>';
  quizCategoryResult.innerHTML = html;
}

// ==================== STATISTIK ====================
statsFilterCategory.addEventListener('change', renderDetailedQuestionStats);
statsFilterPerformance.addEventListener('change', renderDetailedQuestionStats);
resetStatsBtn.addEventListener('click', resetStatistics);

function renderStatistics() {
  const totals = questions.reduce((sum, question) => {
    const stats = question.stats || { correct: 0, wrong: 0 };
    sum.correct += stats.correct;
    sum.wrong += stats.wrong;
    return sum;
  }, { correct: 0, wrong: 0 });

  const answered = totals.correct + totals.wrong;
  const accuracy = answered === 0 ? 0 : Math.round((totals.correct / answered) * 100);

  statTotalQuestions.textContent = questions.length;
  statTotalAnswered.textContent = answered;
  statCorrect.textContent = totals.correct;
  statWrong.textContent = totals.wrong;
  statAccuracy.textContent = `${accuracy}%`;

  renderWeakQuestions();
  renderCategoryStatistics();
  renderDetailedQuestionStats();
}

function getQuestionPerformance(question) {
  const stats = question.stats || { correct: 0, wrong: 0 };
  const answered = stats.correct + stats.wrong;
  const accuracy = answered === 0 ? null : Math.round((stats.correct / answered) * 100);

  return { correct: stats.correct, wrong: stats.wrong, answered, accuracy };
}

function renderWeakQuestions() {
  const weakQuestions = questions
    .filter(question => getQuestionPerformance(question).wrong > 0)
    .sort((a, b) => {
      const statsA = getQuestionPerformance(a);
      const statsB = getQuestionPerformance(b);
      if (statsB.wrong !== statsA.wrong) return statsB.wrong - statsA.wrong;
      return (statsA.accuracy ?? 100) - (statsB.accuracy ?? 100);
    });

  if (weakQuestions.length === 0) {
    weakQuestionsList.innerHTML = '<div class="empty-stats">Noch keine falsch beantworteten Fragen. Starte ein Quiz, um Daten zu sammeln.</div>';
    return;
  }

  weakQuestionsList.innerHTML = weakQuestions.map(question => createQuestionStatCard(question)).join('');
}

function renderCategoryStatistics() {
  const categoryData = {};

  questions.forEach(question => {
    const category = question.category || 'Ohne Kategorie';
    const stats = getQuestionPerformance(question);

    if (!categoryData[category]) {
      categoryData[category] = { correct: 0, wrong: 0, questions: 0 };
    }

    categoryData[category].correct += stats.correct;
    categoryData[category].wrong += stats.wrong;
    categoryData[category].questions++;
  });

  const entries = Object.entries(categoryData).sort(([, a], [, b]) => {
    const answeredA = a.correct + a.wrong;
    const answeredB = b.correct + b.wrong;
    const accuracyA = answeredA === 0 ? -1 : a.correct / answeredA;
    const accuracyB = answeredB === 0 ? -1 : b.correct / answeredB;
    return accuracyA - accuracyB;
  });

  if (entries.length === 0) {
    categoryStatsList.innerHTML = '<div class="empty-stats">Noch keine Kategorien vorhanden.</div>';
    return;
  }

  categoryStatsList.innerHTML = entries.map(([category, stats]) => {
    const answered = stats.correct + stats.wrong;
    const accuracy = answered === 0 ? 0 : Math.round((stats.correct / answered) * 100);
    const level = accuracy < 50 ? 'low' : accuracy < 75 ? 'medium' : '';
    const resultText = answered === 0
      ? `${stats.questions} Fragen, noch nicht beantwortet`
      : `${stats.correct}/${answered} richtig (${accuracy}%)`;

    return `
      <div class="category-stat-row">
        <span class="category-stat-name">${escapeHtml(category)}</span>
        <div class="progress-bar"><div class="progress-bar-fill ${level}" style="width:${accuracy}%"></div></div>
        <span class="category-stat-percent">${resultText}</span>
      </div>
    `;
  }).join('');
}

function renderDetailedQuestionStats() {
  const selectedCategory = statsFilterCategory.value;
  const selectedPerformance = statsFilterPerformance.value;

  let filteredQuestions = selectedCategory
    ? questions.filter(question => question.category === selectedCategory)
    : [...questions];

  if (selectedPerformance === 'weak') {
    filteredQuestions = filteredQuestions.filter(question => {
      const stats = getQuestionPerformance(question);
      return stats.wrong > stats.correct || stats.wrong > 0 && stats.answered === 0;
    });
  }

  if (selectedPerformance === 'good') {
    filteredQuestions = filteredQuestions.filter(question => {
      const stats = getQuestionPerformance(question);
      return stats.answered > 0 && stats.correct >= stats.wrong;
    });
  }

  filteredQuestions.sort((a, b) => {
    const statsA = getQuestionPerformance(a);
    const statsB = getQuestionPerformance(b);
    if (statsB.wrong !== statsA.wrong) return statsB.wrong - statsA.wrong;
    return (statsA.accuracy ?? -1) - (statsB.accuracy ?? -1);
  });

  if (filteredQuestions.length === 0) {
    allQuestionsStats.innerHTML = '<div class="empty-stats">Keine Fragen für diesen Filter vorhanden.</div>';
    return;
  }

  allQuestionsStats.innerHTML = filteredQuestions.map(question => createQuestionStatCard(question)).join('');
}

function createQuestionStatCard(question) {
  const stats = getQuestionPerformance(question);
  let performanceClass = 'neutral';

  if (stats.answered > 0) {
    performanceClass = stats.wrong > stats.correct ? 'weak' : 'good';
  }

  const accuracyText = stats.accuracy === null ? 'Noch nicht beantwortet' : `${stats.accuracy}% richtig`;
  const categoryBadge = question.category
    ? `<span class="category-badge">${escapeHtml(question.category)}</span>`
    : '<span class="category-badge">Ohne Kategorie</span>';

  return `
    <article class="question-stat-card ${performanceClass}">
      <div class="question-stat-header">
        <strong>Frage</strong>
        ${categoryBadge}
      </div>
      <p class="question-stat-text">${escapeHtml(question.text)}</p>
      <div class="question-stat-values">
        <span class="stat-pill correct">✓ ${stats.correct} richtig</span>
        <span class="stat-pill wrong">✕ ${stats.wrong} falsch</span>
        <span class="stat-pill accuracy">${accuracyText}</span>
      </div>
    </article>
  `;
}

function resetStatistics() {
  const confirmed = window.confirm('Möchtest du wirklich alle Antwort-Statistiken zurücksetzen? Deine Fragen bleiben erhalten.');
  if (!confirmed) return;

  questions.forEach(question => {
    question.stats = { correct: 0, wrong: 0 };
  });

  saveQuestions();
  renderStatistics();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}