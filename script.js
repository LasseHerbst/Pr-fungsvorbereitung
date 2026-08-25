const SUPABASE_URL = 'https://hhegggvsrcwyzbpyblxt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sv3o_ptV675_kwnGUYyVsg_u6JjFDxp';

let questions = [];
let quizQueue = [];
let currentQuestionIndex = 0;
let score = 0;
let categories = [];
let quizAnswerResults = [];

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

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Datenbankfehler (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function loadQuestionsFromDB() {
  const rows = await api('questions?select=*&order=created_at.desc');
  return rows.map(row => ({
    id: row.id,
    text: row.text,
    category: row.category,
    image: row.image,
    answers: row.answers,
    correctIndex: row.correct_index,
    stats: {
      correct: row.stats_correct || 0,
      wrong: row.stats_wrong || 0
    }
  }));
}

async function saveQuestionToDB(question) {
  const rows = await api('questions', {
    method: 'POST',
    body: JSON.stringify({
      text: question.text,
      category: question.category,
      image: question.image,
      answers: question.answers,
      correct_index: question.correctIndex,
      stats_correct: 0,
      stats_wrong: 0
    })
  });
  return rows[0];
}

async function updateQuestionStatsInDB(id, stats) {
  await api(`questions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      stats_correct: stats.correct,
      stats_wrong: stats.wrong
    })
  });
}

async function deleteQuestionFromDB(id) {
  await api(`questions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function initApp() {
  try {
    questions = await loadQuestionsFromDB();
  } catch (error) {
    console.error(error);
    alert('Die Fragen konnten nicht aus Supabase geladen werden. Prüfe bitte, ob die aktuelle script.js auf GitHub gespeichert ist.');
  }

  extractCategories();
  renderCategoryFilters();
  renderCategorySuggestions();
  renderQuestionsList();
  loadTheme();
}

function showSection(section) {
  editorSection.style.display = section === 'editor' ? 'block' : 'none';
  quizSection.style.display = section === 'quiz' ? 'block' : 'none';
  statsSection.style.display = section === 'stats' ? 'block' : 'none';
  btnEditor.classList.toggle('active', section === 'editor');
  btnQuiz.classList.toggle('active', section === 'quiz');
  btnStats.classList.toggle('active', section === 'stats');
}

function loadTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const previousTheme = document.documentElement.getAttribute('data-theme');
  const theme = previousTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
});

btnEditor.addEventListener('click', () => showSection('editor'));
btnQuiz.addEventListener('click', () => {
  showSection('quiz');
  showQuizStart();
});
btnStats.addEventListener('click', () => {
  showSection('stats');
  renderStatistics();
});

questionImage.addEventListener('change', event => {
  const file = event.target.files[0];
  imagePreview.innerHTML = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = loadEvent => {
    const image = document.createElement('img');
    image.src = loadEvent.target.result;
    imagePreview.appendChild(image);
  };
  reader.readAsDataURL(file);
});

function extractCategories() {
  categories = [...new Set(questions.map(question => question.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de'));
}

function renderCategorySuggestions() {
  categorySuggestions.innerHTML = '';
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-suggestion';
    button.textContent = category;
    button.addEventListener('click', () => { questionCategory.value = category; });
    categorySuggestions.appendChild(button);
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
  rows.forEach(row => { row.querySelector('.remove-answer').disabled = rows.length <= 2; });
}

answersContainer.addEventListener('click', event => {
  if (!event.target.classList.contains('remove-answer')) return;
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
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

questionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = questionForm.querySelector('button[type="submit"]');
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
  const answers = rows.map(row => row.querySelector('.answer-input').value.trim());
  const correctIndex = rows.findIndex(row => row.querySelector('input[type="radio"]').checked);

  if (!questionText.value.trim() || answers.some(answer => !answer) || correctIndex < 0) {
    alert('Bitte fülle die Frage, alle Antworten und die richtige Antwort aus.');
    return;
  }

  const question = {
    text: questionText.value.trim(),
    category: questionCategory.value.trim() || null,
    image: imagePreview.querySelector('img')?.src || null,
    answers,
    correctIndex
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Wird gespeichert ...';

  try {
    const savedQuestion = await saveQuestionToDB(question);
    questions.unshift({
      ...question,
      id: savedQuestion.id,
      stats: { correct: 0, wrong: 0 }
    });
    extractCategories();
    renderCategoryFilters();
    renderCategorySuggestions();
    renderQuestionsList();
    questionForm.reset();
    imagePreview.innerHTML = '';
    resetAnswersToDefault();
  } catch (error) {
    console.error(error);
    alert('Speichern fehlgeschlagen. Prüfe in Supabase, dass RLS ausgeschaltet ist, und lade danach die Seite neu.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Frage speichern';
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

filterCategory.addEventListener('change', renderQuestionsList);

function renderQuestionsList() {
  const selectedCategory = filterCategory.value;
  const visibleQuestions = selectedCategory
    ? questions.filter(question => question.category === selectedCategory)
    : questions;
  questionsList.innerHTML = '';
  if (visibleQuestions.length === 0) {
    questionsList.innerHTML = `<p style="color:var(--text-secondary);">${questions.length === 0 ? 'Noch keine Fragen gespeichert.' : 'Keine Fragen in dieser Kategorie.'}</p>`;
    return;
  }

  visibleQuestions.forEach((question, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    const category = question.category ? `<span class="category-badge">${escapeHtml(question.category)}</span>` : '';
    const image = question.image ? `<img src="${question.image}" alt="Fragebild" />` : '';
    const answers = question.answers.map((answer, answerIndex) =>
      `<li>${answerIndex === question.correctIndex ? '●' : '○'} ${escapeHtml(answer)}</li>`
    ).join('');
    card.innerHTML = `
      <div class="question-card-header"><strong>Frage ${index + 1}:</strong>${category}</div>
      <p>${escapeHtml(question.text)}</p>
      ${image}
      <ul>${answers}</ul>
      <button class="delete-question" data-id="${question.id}">Frage löschen</button>
    `;
    questionsList.appendChild(card);
  });

  questionsList.querySelectorAll('.delete-question').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Diese Frage wirklich löschen?')) return;
      try {
        await deleteQuestionFromDB(button.dataset.id);
        questions = questions.filter(question => String(question.id) !== button.dataset.id);
        extractCategories();
        renderCategoryFilters();
        renderCategorySuggestions();
        renderQuestionsList();
      } catch (error) {
        console.error(error);
        alert('Löschen fehlgeschlagen.');
      }
    });
  });
}

startQuizBtn.addEventListener('click', startQuiz);
restartQuizBtn.addEventListener('click', startQuiz);
quitQuizBtn.addEventListener('click', showQuizStart);
nextQuestionBtn.addEventListener('click', goToNextQuestion);

function startQuiz() {
  const selectedCategory = quizCategoryFilter.value;
  let selectedQuestions = selectedCategory
    ? questions.filter(question => question.category === selectedCategory)
    : [...questions];
  if (selectedQuestions.length === 0) {
    alert('Bitte lege zuerst mindestens eine passende Frage an.');
    return;
  }
  if (quizModeFilter.value === 'weak') selectedQuestions = createWeakQuestionQueue(selectedQuestions);
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
    for (let index = 0; index < repetitions; index++) queue.push(question);
  });
  return queue;
}

function shuffleArray(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
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
  answerButtons.forEach(button => { button.disabled = true; });
  const isCorrect = selectedIndex === question.correctIndex;
  if (isCorrect) {
    question.stats.correct++;
    score++;
    selectedButton.classList.add('correct');
    quizFeedback.textContent = 'Richtig! 🎉';
    quizFeedback.className = 'quiz-feedback show correct';
  } else {
    question.stats.wrong++;
    selectedButton.classList.add('wrong');
    answerButtons[question.correctIndex].classList.add('correct');
    quizFeedback.textContent = 'Leider falsch. Die richtige Antwort ist markiert.';
    quizFeedback.className = 'quiz-feedback show wrong';
  }
  quizAnswerResults.push({ category: question.category || 'Ohne Kategorie', correct: isCorrect });
  try {
    await updateQuestionStatsInDB(question.id, question.stats);
  } catch (error) {
    console.error(error);
  }
  nextQuestionBtn.style.display = 'inline-block';
}

function goToNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= quizQueue.length) showQuizEnd();
  else showQuestion();
}

function renderQuizCategoryResult() {
  const result = {};
  quizAnswerResults.forEach(entry => {
    if (!result[entry.category]) result[entry.category] = { correct: 0, total: 0 };
    result[entry.category].total++;
    if (entry.correct) result[entry.category].correct++;
  });
  const entries = Object.entries(result);
  quizCategoryResult.innerHTML = entries.length
    ? `<h4>Ergebnis nach Kategorien:</h4><ul>${entries.map(([category, stats]) => `<li>${escapeHtml(category)}: ${stats.correct}/${stats.total} richtig</li>`).join('')}</ul>`
    : '';
}

statsFilterCategory.addEventListener('change', renderDetailedQuestionStats);
statsFilterPerformance.addEventListener('change', renderDetailedQuestionStats);
resetStatsBtn.addEventListener('click', resetStatistics);

function getQuestionPerformance(question) {
  const correct = Number(question.stats?.correct) || 0;
  const wrong = Number(question.stats?.wrong) || 0;
  const answered = correct + wrong;
  return { correct, wrong, answered, accuracy: answered ? Math.round((correct / answered) * 100) : null };
}

function renderStatistics() {
  const total = questions.reduce((summary, question) => {
    const stats = getQuestionPerformance(question);
    summary.correct += stats.correct;
    summary.wrong += stats.wrong;
    return summary;
  }, { correct: 0, wrong: 0 });
  const answered = total.correct + total.wrong;
  statTotalQuestions.textContent = questions.length;
  statTotalAnswered.textContent = answered;
  statCorrect.textContent = total.correct;
  statWrong.textContent = total.wrong;
  statAccuracy.textContent = `${answered ? Math.round((total.correct / answered) * 100) : 0}%`;
  renderWeakQuestions();
  renderCategoryStatistics();
  renderDetailedQuestionStats();
}

function renderWeakQuestions() {
  const weakQuestions = questions.filter(question => getQuestionPerformance(question).wrong > 0)
    .sort((a, b) => getQuestionPerformance(b).wrong - getQuestionPerformance(a).wrong);
  weakQuestionsList.innerHTML = weakQuestions.length
    ? weakQuestions.map(createQuestionStatCard).join('')
    : '<div class="empty-stats">Noch keine falsch beantworteten Fragen. Starte ein Quiz, um Daten zu sammeln.</div>';
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
  categoryStatsList.innerHTML = entries.length ? entries.map(([category, stats]) => {
    const answered = stats.correct + stats.wrong;
    const accuracy = answered ? Math.round((stats.correct / answered) * 100) : 0;
    const level = accuracy < 50 ? 'low' : accuracy < 75 ? 'medium' : '';
    const label = answered ? `${stats.correct}/${answered} richtig (${accuracy}%)` : `${stats.questions} Fragen, noch nicht beantwortet`;
    return `<div class="category-stat-row"><span class="category-stat-name">${escapeHtml(category)}</span><div class="progress-bar"><div class="progress-bar-fill ${level}" style="width:${accuracy}%"></div></div><span class="category-stat-percent">${label}</span></div>`;
  }).join('') : '<div class="empty-stats">Noch keine Kategorien vorhanden.</div>';
}

function renderDetailedQuestionStats() {
  const category = statsFilterCategory.value;
  const performance = statsFilterPerformance.value;
  let visibleQuestions = category ? questions.filter(question => question.category === category) : [...questions];
  if (performance === 'weak') visibleQuestions = visibleQuestions.filter(question => getQuestionPerformance(question).wrong > getQuestionPerformance(question).correct);
  if (performance === 'good') visibleQuestions = visibleQuestions.filter(question => {
    const stats = getQuestionPerformance(question);
    return stats.answered > 0 && stats.correct >= stats.wrong;
  });
  visibleQuestions.sort((a, b) => getQuestionPerformance(b).wrong - getQuestionPerformance(a).wrong);
  allQuestionsStats.innerHTML = visibleQuestions.length
    ? visibleQuestions.map(createQuestionStatCard).join('')
    : '<div class="empty-stats">Keine Fragen für diesen Filter vorhanden.</div>';
}

function createQuestionStatCard(question) {
  const stats = getQuestionPerformance(question);
  const performanceClass = stats.answered === 0 ? 'neutral' : stats.wrong > stats.correct ? 'weak' : 'good';
  const category = question.category || 'Ohne Kategorie';
  const accuracy = stats.accuracy === null ? 'Noch nicht beantwortet' : `${stats.accuracy}% richtig`;
  return `<article class="question-stat-card ${performanceClass}"><div class="question-stat-header"><strong>Frage</strong><span class="category-badge">${escapeHtml(category)}</span></div><p class="question-stat-text">${escapeHtml(question.text)}</p><div class="question-stat-values"><span class="stat-pill correct">✓ ${stats.correct} richtig</span><span class="stat-pill wrong">✕ ${stats.wrong} falsch</span><span class="stat-pill accuracy">${accuracy}</span></div></article>`;
}

async function resetStatistics() {
  if (!window.confirm('Möchtest du wirklich alle Antwort-Statistiken zurücksetzen? Deine Fragen bleiben erhalten.')) return;
  questions.forEach(question => { question.stats = { correct: 0, wrong: 0 }; });
  try {
    await Promise.all(questions.map(question => updateQuestionStatsInDB(question.id, question.stats)));
    renderStatistics();
  } catch (error) {
    console.error(error);
    alert('Die Statistik konnte nicht vollständig zurückgesetzt werden.');
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

initApp();
