// ==================== SUPABASE KONFIGURATION ====================
const SUPABASE_URL = 'https://hhegggvsrcwyzbpyblxt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZWdnZ3ZzcmN3eXpicHlibHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NDM1NDcsImV4cCI6MjEwMzIxOTU0N30.0U4wV6tJq1BpFPvd-g7KmCt1DLjXug6e8UdKQJDjEO4';

// ==================== STATE ====================
let questions = [];
let quizQueue = [];
let currentQuestionIndex = 0;
let score = 0;
let categories = [];
let quizAnswerResults = [];

// ==================== SUPABASE CLIENT ====================
async function supabaseQuery(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(sql)
  });
  return await response.json();
}

async function loadQuestionsFromDB() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/questions?order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await response.json();
    return data.map(q => ({
      id: q.id,
      text: q.text,
      category: q.category,
      image: q.image,
      answers: q.answers,
      correctIndex: q.correct_index,
      stats: { correct: q.stats_correct || 0, wrong: q.stats_wrong || 0 }
    }));
  } catch (error) {
    console.error('Fehler beim Laden:', error);
    return [];
  }
}

async function saveQuestionToDB(question) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: question.text,
        category: question.category,
        image: question.image,
        answers: question.answers,
        correct_index: question.correctIndex,
        stats_correct: question.stats.correct,
        stats_wrong: question.stats.wrong
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    return null;
  }
}

async function updateQuestionStatsInDB(id, stats) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stats_correct: stats.correct,
        stats_wrong: stats.wrong
      })
    });
  } catch (error) {
    console.error('Fehler beim Update:', error);
  }
}

async function deleteQuestionFromDB(id) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
  }
}

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
initApp();

async function initApp() {
  questions = await loadQuestionsFromDB();
  migrateQuestions();
  extractCategories();
  renderCategoryFilters();
  renderCategorySuggestions();
  renderQuestionsList();
  loadTheme();
}

// ==================== THEME ====================
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

// ==================== EDITOR: BILD ====================
questionImage.addEventListener('change', (event) => {
  const file = event.target.files[0];
  imagePreview.innerHTML = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const image = document.createElement('img');
    image.src = loadEvent.target.result;
    imagePreview.appendChild(image);
  };
  reader.readAsDataURL(file);
});

// ==================== EDITOR: KATEGORIEN ====================
function extractCategories() {
  const categorySet = new Set();
  questions.forEach(question => {
    if (question.category && question.category.trim()) {
      categorySet.add(question.category.trim());
    }
  });
  categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'de'));
}

function renderCategorySuggestions() {
  categorySuggestions.innerHTML = '';
  categories.forEach(category => {
    const suggestion = document.createElement('span');
    suggestion.className = 'category-suggestion';
    suggestion.textContent = category;
    suggestion.addEventListener('click', () => {
      questionCategory.value = category;
    });
    categorySuggestions.appendChild(suggestion);
  });
}

function renderCategoryFilters() {
  const editorValue = filterCategory.value;
  const quizValue = quizCategoryFilter.value;
  const statsValue = statsFilterCategory.value;
  const options = '<option value="">Alle Kategorien</option>' +
    categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');

  filterCategory.innerHTML = options;
  quizCategoryFilter.innerHTML = options;
  statsFilterCategory.innerHTML = options;

  filterCategory.value = categories.includes(editorValue) ? editorValue : '';
  quizCategoryFilter.value = categories.includes(quizValue) ? quizValue : '';
  statsFilterCategory.value = categories.includes(statsValue) ? statsValue : '';
}

// ==================== EDITOR: ANTWORTEN ====================
addAnswerBtn.addEventListener('click', () => {
  const index = answersContainer.querySelectorAll('.answer-row').length;
  const row = document.createElement('div');
  row.className = 'answer-row';
  row.innerHTML = `
    <input type="text" class="answer-input" placeholder="Antwort ${index + 1}" required />
    <label><input type="radio" name="correct-answer" value="${index}" /> richtig</label>
    <button type="button" class="remove-answer">&times;</button>
  `;
  answersContainer.appendChild(row);
  updateRemoveButtons();
});

function updateRemoveButtons() {
  const rows = answersContainer.querySelectorAll('.answer-row');
  rows.forEach(row => {
    row.querySelector('.remove-answer').disabled = rows.length <= 2;
  });
}

answersContainer.addEventListener('click', (event) => {
  if (!event.target.classList.contains('remove-answer')) return;
  const rows = answersContainer.querySelectorAll('.answer-row');
  if (rows.length <= 2) return;
  event.target.closest('.answer-row').remove();
  reindexAnswers();
  updateRemoveButtons();
});

function reindexAnswers() {
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
  const selectedRow = rows.find(row => row.querySelector('input[type="radio"]').checked) || rows[0];
  rows.forEach((row, index) => {
    row.querySelector('.answer-input').placeholder = `Antwort ${index + 1}`;
    const radio = row.querySelector('input[type="radio"]');
    radio.value = index;
    radio.checked = row === selectedRow;
  });
}

// ==================== EDITOR: SPEICHERN ====================
questionForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const answerRows = [...answersContainer.querySelectorAll('.answer-row')];
  const selectedRow = answerRows.find(row => row.querySelector('input[type="radio"]').checked);
  const answers = answerRows.map(row => row.querySelector('.answer-input').value.trim());

  if (answers.some(answer => !answer)) {
    alert('Bitte fülle alle Antwortmöglichkeiten aus.');
    return;
  }

  const correctIndex = answerRows.indexOf(selectedRow);
  if (correctIndex === -1) {
    alert('Bitte markiere eine richtige Antwort.');
    return;
  }

  const question = {
    text: questionText.value.trim(),
    category: questionCategory.value.trim() || null,
    image: imagePreview.querySelector('img')?.src || null,
    answers,
    correctIndex,
    stats: { correct: 0, wrong: 0 }
  };

  const saved = await saveQuestionToDB(question);
  if (saved && saved[0]) {
    questions.unshift({
      id: saved[0].id,
      ...question,
      stats: { correct: 0, wrong: 0 }
    });
    extractCategories();
    renderCategoryFilters();
    renderCategorySuggestions();
    renderQuestionsList();
    questionForm.reset();
    imagePreview.innerHTML = '';
    resetAnswersToDefault();
    alert('Frage erfolgreich gespeichert! ✓');
  } else {
    alert('Fehler beim Speichern. Bitte prüfe die Supabase-Einstellungen.');
  }
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

// ==================== EDITOR: FRAGENLISTE ====================
filterCategory.addEventListener('change', renderQuestionsList);

function renderQuestionsList() {
  const selectedCategory = filterCategory.value;
  const visibleQuestions = selectedCategory
    ? questions.filter(question => question.category === selectedCategory)
    : questions;

  questionsList.innerHTML = '';

  if (visibleQuestions.length === 0) {
    const message = questions.length === 0
      ? 'Noch keine Fragen gespeichert.'
      : 'Keine Fragen in dieser Kategorie.';
    questionsList.innerHTML = `<p style="color:var(--text-secondary);">${message}</p>`;
    return;
  }

  visibleQuestions.forEach((question, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';

    const category = question.category
      ? `<span class="category-badge">${escapeHtml(question.category)}</span>`
      : '';
    const image = question.image
      ? `<img src="${question.image}" alt="Fragebild" />`
      : '';
    const answers = question.answers.map((answer, answerIndex) => {
      const marker = answerIndex === question.correctIndex ? '●' : '○';
      return `<li>${marker} ${escapeHtml(answer)}</li>`;
    }).join('');

    card.innerHTML = `
      <div class="question-card-header">
        <strong>Frage ${index + 1}:</strong>
        ${category}
      </div>
      <p>${escapeHtml(question.text)}</p>
      ${image}
      <ul>${answers}</ul>
      <button class="delete-question" data-id="${question.id}">Frage löschen</button>
    `;

    questionsList.appendChild(card);
  });

  questionsList.querySelectorAll('.delete-question').forEach(button => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.id);
      await deleteQuestionFromDB(id);
      questions = questions.filter(question => question.id !== id);
      extractCategories();
      renderCategoryFilters();
      renderCategorySuggestions();
      renderQuestionsList();
    });
  });
}

function migrateQuestions() {
  let changed = false;
  questions.forEach(question => {
    if (!question.stats || typeof question.stats.correct !== 'number' || typeof question.stats.wrong !== 'number') {
      question.stats = { correct: 0, wrong: 0 };
      changed = true;
    }
  });
  if (changed) {
    questions.forEach(q => updateQuestionStatsInDB(q.id, q.stats));
  }
}

// ==================== QUIZ ====================
startQuizBtn.addEventListener('click', startQuiz);
restartQuizBtn.addEventListener('click', startQuiz);
quitQuizBtn.addEventListener('click', showQuizStart);
nextQuestionBtn.addEventListener('click', goToNextQuestion);

function startQuiz() {
  if (questions.length === 0) {
    alert('Bitte erst mindestens eine Frage im Editor anlegen.');
    return;
  }

  const selectedCategory = quizCategoryFilter.value;
  const mode = quizModeFilter.value;
  let selectedQuestions = selectedCategory
    ? questions.filter(question => question.category === selectedCategory)
    : [...questions];

  if (selectedQuestions.length === 0) {
    alert('Keine Fragen in dieser Kategorie vorhanden.');
    return;
  }

  if (mode === 'weak') {
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
  const queue = [];
  sourceQuestions.forEach(question => {
    const stats = getQuestionPerformance(question);
    let repetitions = 1;
    if (stats.answered === 0) repetitions = 2;
    else if (stats.accuracy < 40) repetitions = 4;
    else if (stats.accuracy < 70) repetitions = 3;
    else if (stats.accuracy < 90) repetitions = 2;
    for (let i = 0; i < repetitions; i++) queue.push(question);
  });
  return queue;
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
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

  question.answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.className = 'quiz-answer-btn';
    button.textContent = answer;
    button.addEventListener('click', () => handleAnswer(index, button));
    quizAnswers.appendChild(button);
  });
}

async function handleAnswer(selectedIndex, selectedButton) {
  const question = quizQueue[currentQuestionIndex];
  const answerButtons = quizAnswers.querySelectorAll('.quiz-answer-btn');
  answerButtons.forEach(button => button.disabled = true);

  const isCorrect = selectedIndex === question.correctIndex;
  question.stats = question.stats || { correct: 0, wrong: 0 };

  if (isCorrect) {
    selectedButton.classList.add('correct');
    quizFeedback.textContent = 'Richtig! 🎉';
    quizFeedback.className = 'quiz-feedback show correct';
    question.stats.correct++;
    score++;
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

  await updateQuestionStatsInDB(question.id, question.stats);
  nextQuestionBtn.style.display = 'inline-block';
}

function goToNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= quizQueue.length) {
    showQuizEnd();
  } else {
    showQuestion();
  }
}

function renderQuizCategoryResult() {
  const categoryStats = {};
  quizAnswerResults.forEach(result => {
    if (!categoryStats[result.category]) {
      categoryStats[result.category] = { correct: 0, total: 0 };
    }
    categoryStats[result.category].total++;
    if (result.correct) categoryStats[result.category].correct++;
  });

  const entries = Object.entries(categoryStats);
  if (entries.length === 0) {
    quizCategoryResult.innerHTML = '';
    return;
  }

  const rows = entries.map(([category, stats]) =>
    `<li>${escapeHtml(category)}: ${stats.correct}/${stats.total} richtig</li>`
  ).join('');
  quizCategoryResult.innerHTML = `<h4>Ergebnis nach Kategorien:</h4><ul>${rows}</ul>`;
}

// ==================== STATISTIK ====================
statsFilterCategory.addEventListener('change', renderDetailedQuestionStats);
statsFilterPerformance.addEventListener('change', renderDetailedQuestionStats);
resetStatsBtn.addEventListener('click', resetStatistics);

function getQuestionPerformance(question) {
  const stats = question.stats || { correct: 0, wrong: 0 };
  const correct = Number(stats.correct) || 0;
  const wrong = Number(stats.wrong) || 0;
  const answered = correct + wrong;
  const accuracy = answered === 0 ? null : Math.round((correct / answered) * 100);
  return { correct, wrong, answered, accuracy };
}

function renderStatistics() {
  const totals = questions.reduce((result, question) => {
    const stats = getQuestionPerformance(question);
    result.correct += stats.correct;
    result.wrong += stats.wrong;
    return result;
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

  weakQuestionsList.innerHTML = weakQuestions.map(createQuestionStatCard).join('');
}

function renderCategoryStatistics() {
  const data = {};
  questions.forEach(question => {
    const category = question.category || 'Ohne Kategorie';
    const stats = getQuestionPerformance(question);
    if (!data[category]) data[category] = { correct: 0, wrong: 0, questions: 0 };
    data[category].correct += stats.correct;
    data[category].wrong += stats.wrong;
    data[category].questions++;
  });

  const entries = Object.entries(data);
  if (entries.length === 0) {
    categoryStatsList.innerHTML = '<div class="empty-stats">Noch keine Kategorien vorhanden.</div>';
    return;
  }

  categoryStatsList.innerHTML = entries.map(([category, stats]) => {
    const answered = stats.correct + stats.wrong;
    const accuracy = answered === 0 ? 0 : Math.round((stats.correct / answered) * 100);
    const level = accuracy < 50 ? 'low' : accuracy < 75 ? 'medium' : '';
    const text = answered === 0
      ? `${stats.questions} Fragen, noch nicht beantwortet`
      : `${stats.correct}/${answered} richtig (${accuracy}%)`;

    return `
      <div class="category-stat-row">
        <span class="category-stat-name">${escapeHtml(category)}</span>
        <div class="progress-bar"><div class="progress-bar-fill ${level}" style="width:${accuracy}%"></div></div>
        <span class="category-stat-percent">${text}</span>
      </div>
    `;
  }).join('');
}

function renderDetailedQuestionStats() {
  const category = statsFilterCategory.value;
  const performance = statsFilterPerformance.value;
  let visibleQuestions = category
    ? questions.filter(question => question.category === category)
    : [...questions];

  if (performance === 'weak') {
    visibleQuestions = visibleQuestions.filter(question => {
      const stats = getQuestionPerformance(question);
      return stats.wrong > stats.correct;
    });
  }

  if (performance === 'good') {
    visibleQuestions = visibleQuestions.filter(question => {
      const stats = getQuestionPerformance(question);
      return stats.answered > 0 && stats.correct >= stats.wrong;
    });
  }

  visibleQuestions.sort((a, b) => getQuestionPerformance(b).wrong - getQuestionPerformance(a).wrong);

  if (visibleQuestions.length === 0) {
    allQuestionsStats.innerHTML = '<div class="empty-stats">Keine Fragen für diesen Filter vorhanden.</div>';
    return;
  }

  allQuestionsStats.innerHTML = visibleQuestions.map(createQuestionStatCard).join('');
}

function createQuestionStatCard(question) {
  const stats = getQuestionPerformance(question);
  const performanceClass = stats.answered === 0
    ? 'neutral'
    : stats.wrong > stats.correct ? 'weak' : 'good';
  const category = question.category || 'Ohne Kategorie';
  const accuracyText = stats.accuracy === null ? 'Noch nicht beantwortet' : `${stats.accuracy}% richtig`;

  return `
    <article class="question-stat-card ${performanceClass}">
      <div class="question-stat-header">
        <strong>Frage</strong>
        <span class="category-badge">${escapeHtml(category)}</span>
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

async function resetStatistics() {
  const confirmed = window.confirm('Möchtest du wirklich alle Antwort-Statistiken zurücksetzen? Deine Fragen bleiben erhalten.');
  if (!confirmed) return;

  questions.forEach(question => {
    question.stats = { correct: 0, wrong: 0 };
    updateQuestionStatsInDB(question.id, question.stats);
  });

  renderStatistics();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
