const SUPABASE_URL = 'https://hhegggvsrcwyzbpyblxt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sv3o_ptV675_kwnGUYyVsg_u6JjFDxp';

let questions = [];
let profiles = [];
let personalStats = new Map();
let currentProfile = null;
let categories = [];
let quizQueue = [];
let quizResults = [];
let currentQuestionIndex = 0;
let score = 0;

const $ = (selector) => document.querySelector(selector);

const loginOverlay = $('#login-overlay');
const loginForm = $('#login-form');
const loginName = $('#login-name');
const loginPin = $('#login-pin');
const loginError = $('#login-error');
const loginSubmit = $('#login-submit');
const currentUserLabel = $('#current-user-label');
const switchProfileBtn = $('#switch-profile');
const themeToggle = $('#theme-toggle');

const btnEditor = $('#btn-editor');
const btnQuiz = $('#btn-quiz');
const btnStats = $('#btn-stats');
const editorSection = $('#editor-section');
const quizSection = $('#quiz-section');
const statsSection = $('#stats-section');

const questionForm = $('#question-form');
const questionText = $('#question-text');
const questionCategory = $('#question-category');
const categorySuggestions = $('#category-suggestions');
const questionImage = $('#question-image');
const imagePreview = $('#image-preview');
const answersContainer = $('#answers-container');
const addAnswerBtn = $('#add-answer');
const clearFormBtn = $('#clear-form');
const questionsList = $('#questions-list');
const questionCount = $('#question-count');
const filterCategory = $('#filter-category');

const quizStart = $('#quiz-start');
const quizActive = $('#quiz-active');
const quizEnd = $('#quiz-end');
const quizCategoryFilter = $('#quiz-category-filter');
const quizModeFilter = $('#quiz-mode-filter');
const startQuizBtn = $('#start-quiz');
const quitQuizBtn = $('#quit-quiz');
const restartQuizBtn = $('#restart-quiz');
const quizProgress = $('#quiz-progress');
const quizCategoryBadge = $('#quiz-category-badge');
const quizQuestionText = $('#quiz-question-text');
const quizQuestionImage = $('#quiz-question-image');
const quizAnswers = $('#quiz-answers');
const quizFeedback = $('#quiz-feedback');
const nextQuestionBtn = $('#next-question');
const quizResult = $('#quiz-result');
const quizCategoryResult = $('#quiz-category-result');

const statsUserInfo = $('#stats-user-info');
const statTotalQuestions = $('#stat-total-questions');
const statTotalAnswered = $('#stat-total-answered');
const statCorrect = $('#stat-correct');
const statWrong = $('#stat-wrong');
const statAccuracy = $('#stat-accuracy');
const weakQuestionsList = $('#weak-questions-list');
const categoryStatsList = $('#category-stats-list');
const allQuestionsStats = $('#all-questions-stats');
const statsFilterCategory = $('#stats-filter-category');
const statsFilterPerformance = $('#stats-filter-performance');
const resetStatsBtn = $('#reset-stats');

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
    const errorText = await response.text();
    throw new Error(errorText || `Datenbankfehler (${response.status})`);
  }

  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
}

async function loadProfiles() {
  return api('profiles?select=id,display_name,pin_code&order=display_name.asc');
}

async function loadQuestions() {
  const rows = await api('questions?select=*&order=created_at.desc');
  return rows.map(row => ({
    id: row.id,
    text: row.text,
    category: row.category,
    image: row.image,
    answers: row.answers || [],
    correctIndex: row.correct_index,
  }));
}

async function loadPersonalStats() {
  if (!currentProfile) return;
  const rows = await api(`user_question_stats?select=question_id,correct_count,wrong_count,last_answered_at&profile_id=eq.${currentProfile.id}`);
  personalStats = new Map(rows.map(row => [Number(row.question_id), {
    correct: Number(row.correct_count) || 0,
    wrong: Number(row.wrong_count) || 0,
    lastAnsweredAt: row.last_answered_at || null
  }]));
}

async function saveQuestion(question) {
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

async function deleteQuestion(id) {
  await api(`questions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function savePersonalStat(questionId, stats) {
  const rows = await api('user_question_stats', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      profile_id: currentProfile.id,
      question_id: questionId,
      correct_count: stats.correct,
      wrong_count: stats.wrong,
      last_answered_at: new Date().toISOString()
    })
  });
  return rows?.[0] || null;
}

async function resetPersonalStats() {
  await api(`user_question_stats?profile_id=eq.${currentProfile.id}`, { method: 'DELETE' });
  personalStats = new Map();
}

async function init() {
  loadTheme();
  try {
    [profiles, questions] = await Promise.all([loadProfiles(), loadQuestions()]);
    fillLoginNames();
    extractCategories();
    renderCategoryFilters();
    renderCategorySuggestions();
    renderQuestionsList();
  } catch (error) {
    console.error(error);
    loginError.textContent = 'Datenbank konnte nicht geladen werden. Bitte Seite neu laden.';
  }

  const savedProfileId = localStorage.getItem('examAppProfileId');
  if (savedProfileId) {
    const savedProfile = profiles.find(profile => String(profile.id) === savedProfileId);
    if (savedProfile) loginName.value = String(savedProfile.id);
  }
  showLogin();
}

function fillLoginNames() {
  loginName.innerHTML = '<option value="">Name auswählen …</option>' +
    profiles.map(profile => `<option value="${profile.id}">${escapeHtml(profile.display_name)}</option>`).join('');
}

function showLogin() {
  loginForm.reset();
  loginError.textContent = '';
  const savedProfileId = localStorage.getItem('examAppProfileId');
  if (savedProfileId) loginName.value = savedProfileId;
  loginOverlay.classList.remove('hidden');
  loginPin.focus();
}

function hideLogin() {
  loginOverlay.classList.add('hidden');
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = profiles.find(item => String(item.id) === loginName.value);
  const pin = loginPin.value.trim();

  if (!profile || !/^\d{4}$/.test(pin)) {
    loginError.textContent = 'Bitte wähle einen Namen und gib eine vierstellige PIN ein.';
    return;
  }

  if (profile.pin_code !== pin) {
    loginError.textContent = 'Name oder PIN ist nicht korrekt.';
    loginPin.value = '';
    loginPin.focus();
    return;
  }

  loginSubmit.disabled = true;
  loginSubmit.textContent = 'Wird angemeldet …';
  try {
    currentProfile = profile;
    await loadPersonalStats();
    localStorage.setItem('examAppProfileId', String(profile.id));
    currentUserLabel.textContent = `Angemeldet: ${profile.display_name}`;
    statsUserInfo.textContent = `Persönliche Lernergebnisse von ${profile.display_name}.`;
    hideLogin();
    renderStatistics();
  } catch (error) {
    console.error(error);
    loginError.textContent = 'Statistik konnte nicht geladen werden. Bitte erneut versuchen.';
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Anmelden';
  }
});

switchProfileBtn.addEventListener('click', () => {
  currentProfile = null;
  personalStats = new Map();
  localStorage.removeItem('examAppProfileId');
  showLogin();
});

function loadTheme() {
  const theme = localStorage.getItem('examAppTheme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  $('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('examAppTheme', nextTheme);
  $('.theme-icon').textContent = nextTheme === 'dark' ? '☀️' : '🌙';
});

function showSection(section) {
  editorSection.style.display = section === 'editor' ? 'block' : 'none';
  quizSection.style.display = section === 'quiz' ? 'block' : 'none';
  statsSection.style.display = section === 'stats' ? 'block' : 'none';
  btnEditor.classList.toggle('active', section === 'editor');
  btnQuiz.classList.toggle('active', section === 'quiz');
  btnStats.classList.toggle('active', section === 'stats');
}

btnEditor.addEventListener('click', () => showSection('editor'));
btnQuiz.addEventListener('click', () => { showSection('quiz'); showQuizStart(); });
btnStats.addEventListener('click', () => { showSection('stats'); renderStatistics(); });

questionImage.addEventListener('change', event => {
  const file = event.target.files?.[0];
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
  categories = [...new Set(questions.map(question => question.category?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de'));
}

function renderCategorySuggestions() {
  categorySuggestions.innerHTML = '';
  categories.forEach(category => {
    const button = document.createElement('button');
    button.className = 'category-suggestion';
    button.type = 'button';
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
    <label class="correct-choice"><input type="radio" name="correct-answer" value="${index}" /> Richtig</label>
    <button type="button" class="remove-answer" aria-label="Antwort entfernen">&times;</button>
  `;
  answersContainer.appendChild(row);
  updateRemoveButtons();
});

answersContainer.addEventListener('click', event => {
  if (!event.target.classList.contains('remove-answer')) return;
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
  if (rows.length <= 2) return;
  event.target.closest('.answer-row').remove();
  reindexAnswers();
  updateRemoveButtons();
});

function updateRemoveButtons() {
  const rows = answersContainer.querySelectorAll('.answer-row');
  rows.forEach(row => { row.querySelector('.remove-answer').disabled = rows.length <= 2; });
}

function reindexAnswers() {
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
  const selected = rows.find(row => row.querySelector('input[type="radio"]').checked) || rows[0];
  rows.forEach((row, index) => {
    row.querySelector('.answer-input').placeholder = `Antwort ${index + 1}`;
    const radio = row.querySelector('input[type="radio"]');
    radio.value = index;
    radio.checked = row === selected;
  });
}

questionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
  const answers = rows.map(row => row.querySelector('.answer-input').value.trim());
  const correctIndex = rows.findIndex(row => row.querySelector('input[type="radio"]').checked);

  if (!questionText.value.trim() || answers.some(answer => !answer) || correctIndex < 0) {
    alert('Bitte fülle die Frage und alle Antworten aus und markiere die richtige Antwort.');
    return;
  }

  const submitButton = questionForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Wird gespeichert …';

  try {
    const saved = await saveQuestion({
      text: questionText.value.trim(),
      category: questionCategory.value.trim() || null,
      image: imagePreview.querySelector('img')?.src || null,
      answers,
      correctIndex
    });

    questions.unshift({
      id: saved.id,
      text: saved.text,
      category: saved.category,
      image: saved.image,
      answers: saved.answers,
      correctIndex: saved.correct_index
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
    alert('Speichern fehlgeschlagen. Bei großen Bildern kann der Datenbank-Eintrag zu groß sein.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Frage speichern';
  }
});

function resetAnswersToDefault() {
  answersContainer.innerHTML = `
    <div class="answer-row">
      <input type="text" class="answer-input" placeholder="Antwort 1" required />
      <label class="correct-choice"><input type="radio" name="correct-answer" value="0" checked /> Richtig</label>
      <button type="button" class="remove-answer" disabled aria-label="Antwort entfernen">&times;</button>
    </div>
    <div class="answer-row">
      <input type="text" class="answer-input" placeholder="Antwort 2" required />
      <label class="correct-choice"><input type="radio" name="correct-answer" value="1" /> Richtig</label>
      <button type="button" class="remove-answer" aria-label="Antwort entfernen">&times;</button>
    </div>
  `;
}

clearFormBtn.addEventListener('click', () => {
  questionForm.reset();
  imagePreview.innerHTML = '';
  resetAnswersToDefault();
});

filterCategory.addEventListener('change', renderQuestionsList);

function renderQuestionsList() {
  const selected = filterCategory.value;
  const visible = selected ? questions.filter(question => question.category === selected) : questions;
  questionCount.textContent = `${visible.length} von ${questions.length} Fragen`;

  if (!visible.length) {
    questionsList.innerHTML = `<div class="empty-stats">${questions.length ? 'Keine Fragen in dieser Kategorie.' : 'Noch keine Fragen gespeichert.'}</div>`;
    return;
  }

  questionsList.innerHTML = visible.map((question, index) => {
    const category = question.category ? `<span class="category-badge">${escapeHtml(question.category)}</span>` : '';
    const image = question.image ? `<img src="${question.image}" alt="Fragebild" />` : '';
    const answers = question.answers.map((answer, answerIndex) =>
      `<li>${answerIndex === question.correctIndex ? '●' : '○'} ${escapeHtml(answer)}</li>`
    ).join('');
    return `
      <article class="question-card">
        <div class="question-card-header"><strong>Frage ${index + 1}</strong>${category}</div>
        <p>${escapeHtml(question.text)}</p>
        ${image}
        <ul>${answers}</ul>
        <button class="delete-question" type="button" data-id="${question.id}">Frage löschen</button>
      </article>
    `;
  }).join('');

  questionsList.querySelectorAll('.delete-question').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Möchtest du diese Frage für alle wirklich löschen?')) return;
      try {
        await deleteQuestion(button.dataset.id);
        questions = questions.filter(question => String(question.id) !== button.dataset.id);
        personalStats.delete(Number(button.dataset.id));
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
nextQuestionBtn.addEventListener('click', nextQuestion);

function startQuiz() {
  let selected = quizCategoryFilter.value
    ? questions.filter(question => question.category === quizCategoryFilter.value)
    : [...questions];

  if (!selected.length) {
    alert('Für diese Auswahl gibt es keine Fragen.');
    return;
  }

  if (quizModeFilter.value === 'weak') selected = createWeakQueue(selected);
  quizQueue = shuffle(selected);
  quizResults = [];
  currentQuestionIndex = 0;
  score = 0;
  showQuizActive();
  showQuestion();
}

function createWeakQueue(source) {
  const queue = [];
  source.forEach(question => {
    const stats = getPerformance(question);
    let repetitions = 1;
    if (stats.answered === 0) repetitions = 2;
    else if (stats.accuracy < 40) repetitions = 4;
    else if (stats.accuracy < 70) repetitions = 3;
    else if (stats.accuracy < 90) repetitions = 2;
    for (let index = 0; index < repetitions; index++) queue.push(question);
  });
  return queue;
}

function shuffle(items) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index--) {
    const random = Math.floor(Math.random() * (index + 1));
    [output[index], output[random]] = [output[random], output[index]];
  }
  return output;
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
  quizQuestionImage.style.display = question.image ? 'block' : 'none';
  if (question.image) quizQuestionImage.src = question.image;

  quizAnswers.innerHTML = '';
  quizFeedback.className = 'quiz-feedback';
  nextQuestionBtn.style.display = 'none';

  question.answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.className = 'quiz-answer-btn';
    button.type = 'button';
    button.textContent = answer;
    button.addEventListener('click', () => answerQuestion(index, button));
    quizAnswers.appendChild(button);
  });
}

async function answerQuestion(answerIndex, clickedButton) {
  const question = quizQueue[currentQuestionIndex];
  const buttons = [...quizAnswers.querySelectorAll('.quiz-answer-btn')];
  buttons.forEach(button => { button.disabled = true; });

  const correct = answerIndex === question.correctIndex;
  const stats = getPerformance(question);
  if (correct) {
    stats.correct++;
    score++;
    clickedButton.classList.add('correct');
    quizFeedback.textContent = 'Richtig! 🎉';
    quizFeedback.className = 'quiz-feedback show correct';
  } else {
    stats.wrong++;
    clickedButton.classList.add('wrong');
    buttons[question.correctIndex]?.classList.add('correct');
    quizFeedback.textContent = 'Leider falsch. Die richtige Antwort ist markiert.';
    quizFeedback.className = 'quiz-feedback show wrong';
  }

  personalStats.set(Number(question.id), stats);
  quizResults.push({ category: question.category || 'Ohne Kategorie', correct });
  try {
    await savePersonalStat(question.id, stats);
  } catch (error) {
    console.error(error);
    alert('Antwort wurde angezeigt, konnte aber nicht in deiner Statistik gespeichert werden.');
  }
  nextQuestionBtn.style.display = 'inline-block';
}

function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= quizQueue.length) showQuizEnd();
  else showQuestion();
}

function renderQuizCategoryResult() {
  const summary = {};
  quizResults.forEach(result => {
    if (!summary[result.category]) summary[result.category] = { correct: 0, total: 0 };
    summary[result.category].total++;
    if (result.correct) summary[result.category].correct++;
  });
  const rows = Object.entries(summary).map(([category, data]) =>
    `<li>${escapeHtml(category)}: ${data.correct}/${data.total} richtig</li>`
  ).join('');
  quizCategoryResult.innerHTML = rows ? `<h4>Ergebnis nach Kategorien</h4><ul>${rows}</ul>` : '';
}

statsFilterCategory.addEventListener('change', renderDetailedStats);
statsFilterPerformance.addEventListener('change', renderDetailedStats);
resetStatsBtn.addEventListener('click', async () => {
  if (!currentProfile || !confirm('Möchtest du wirklich nur deine persönliche Statistik zurücksetzen?')) return;
  try {
    await resetPersonalStats();
    renderStatistics();
  } catch (error) {
    console.error(error);
    alert('Statistik konnte nicht zurückgesetzt werden.');
  }
});

function getPerformance(question) {
  const stored = personalStats.get(Number(question.id));
  const correct = Number(stored?.correct) || 0;
  const wrong = Number(stored?.wrong) || 0;
  const answered = correct + wrong;
  return { correct, wrong, answered, accuracy: answered ? Math.round((correct / answered) * 100) : null };
}

function renderStatistics() {
  if (!currentProfile) return;
  statsUserInfo.textContent = `Persönliche Lernergebnisse von ${currentProfile.display_name}.`;
  const total = questions.reduce((summary, question) => {
    const stats = getPerformance(question);
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
  renderCategoryStats();
  renderDetailedStats();
}

function renderWeakQuestions() {
  const weak = questions.filter(question => getPerformance(question).wrong > 0)
    .sort((a, b) => getPerformance(b).wrong - getPerformance(a).wrong);
  weakQuestionsList.innerHTML = weak.length
    ? weak.map(createStatCard).join('')
    : '<div class="empty-stats">Noch keine falsch beantworteten Fragen. Starte ein Quiz, um Daten zu sammeln.</div>';
}

function renderCategoryStats() {
  const categoriesData = {};
  questions.forEach(question => {
    const category = question.category || 'Ohne Kategorie';
    const stats = getPerformance(question);
    if (!categoriesData[category]) categoriesData[category] = { correct: 0, wrong: 0, questions: 0 };
    categoriesData[category].correct += stats.correct;
    categoriesData[category].wrong += stats.wrong;
    categoriesData[category].questions++;
  });

  const entries = Object.entries(categoriesData);
  categoryStatsList.innerHTML = entries.length ? entries.map(([category, data]) => {
    const answered = data.correct + data.wrong;
    const accuracy = answered ? Math.round((data.correct / answered) * 100) : 0;
    const level = accuracy < 50 ? 'low' : accuracy < 75 ? 'medium' : '';
    const label = answered ? `${data.correct}/${answered} richtig (${accuracy}%)` : `${data.questions} Fragen, noch nicht beantwortet`;
    return `<div class="category-stat-row"><span class="category-stat-name">${escapeHtml(category)}</span><div class="progress-bar"><div class="progress-bar-fill ${level}" style="width:${accuracy}%"></div></div><span class="category-stat-percent">${label}</span></div>`;
  }).join('') : '<div class="empty-stats">Noch keine Kategorien vorhanden.</div>';
}

function renderDetailedStats() {
  const category = statsFilterCategory.value;
  const performance = statsFilterPerformance.value;
  let visible = category ? questions.filter(question => question.category === category) : [...questions];
  if (performance === 'weak') visible = visible.filter(question => {
    const stats = getPerformance(question);
    return stats.wrong > stats.correct;
  });
  if (performance === 'good') visible = visible.filter(question => {
    const stats = getPerformance(question);
    return stats.answered > 0 && stats.correct >= stats.wrong;
  });
  visible.sort((a, b) => getPerformance(b).wrong - getPerformance(a).wrong);
  allQuestionsStats.innerHTML = visible.length
    ? visible.map(createStatCard).join('')
    : '<div class="empty-stats">Keine Fragen für diesen Filter vorhanden.</div>';
}

function createStatCard(question) {
  const stats = getPerformance(question);
  const status = stats.answered === 0 ? 'neutral' : stats.wrong > stats.correct ? 'weak' : 'good';
  const category = question.category || 'Ohne Kategorie';
  const accuracy = stats.accuracy === null ? 'Noch nicht beantwortet' : `${stats.accuracy}% richtig`;
  return `<article class="question-stat-card ${status}"><div class="question-stat-header"><strong>Frage</strong><span class="category-badge">${escapeHtml(category)}</span></div><p class="question-stat-text">${escapeHtml(question.text)}</p><div class="question-stat-values"><span class="stat-pill correct">✓ ${stats.correct} richtig</span><span class="stat-pill wrong">✕ ${stats.wrong} falsch</span><span class="stat-pill accuracy">${accuracy}</span></div></article>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

init();