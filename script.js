const SUPABASE_URL = 'https://hhegggvsrcwyzbpyblxt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sv3o_ptV675_kwnGUYyVsg_u6JjFDxp';
const IMAGE_BUCKET = 'question-images';

const FALLBACK_PROFILES = [
  { id: 1, display_name: 'Lasse', pin_code: '4827' },
  { id: 2, display_name: 'Marie', pin_code: '6159' },
  { id: 3, display_name: 'Rico', pin_code: '7342' },
  { id: 4, display_name: 'Janosch', pin_code: '9581' },
  { id: 5, display_name: 'Elias', pin_code: '3468' },
  { id: 6, display_name: 'Etienne', pin_code: '8274' },
  { id: 7, display_name: 'Reinhard', pin_code: '5693' },
  { id: 8, display_name: 'Nist', pin_code: '2146' }
];

let questions = [];
let profiles = [];
let personalStats = new Map();
let favoriteQuestionIds = new Set();
let currentProfile = null;
let categories = [];
let quizQueue = [];
let quizResults = [];
let currentQuestionIndex = 0;
let score = 0;
let selectedImageFile = null;
let examQueue = [];
let examResults = [];
let examQuestionIndex = 0;
let examScore = 0;
let examTimerId = null;
let examRemainingSeconds = 0;

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

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
const btnExam = $('#btn-exam');
const btnLogins = $('#btn-logins');
const btnStats = $('#btn-stats');
const editorSection = $('#editor-section');
const quizSection = $('#quiz-section');
const examSection = $('#exam-section');
const loginHistorySection = $('#login-history-section');
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

const examStart = $('#exam-start');
const examActive = $('#exam-active');
const examEnd = $('#exam-end');
const examCategoryFilter = $('#exam-category-filter');
const examModeFilter = $('#exam-mode-filter');
const examDuration = $('#exam-duration');
const startExamBtn = $('#start-exam');
const quitExamBtn = $('#quit-exam');
const restartExamBtn = $('#restart-exam');
const examPrintBtn = $('#exam-print');
const examPrintAnswers = $('#exam-print-answers');
const examProgress = $('#exam-progress');
const examCategoryBadge = $('#exam-category-badge');
const examTimer = $('#exam-timer');
const examQuestionText = $('#exam-question-text');
const examQuestionImage = $('#exam-question-image');
const examAnswers = $('#exam-answers');
const examFeedback = $('#exam-feedback');
const examNextBtn = $('#exam-next');
const examResult = $('#exam-result');
const examCategoryResult = $('#exam-category-result');

const loginHistoryProfile = $('#login-history-profile');
const loginHistoryFrom = $('#login-history-from');
const loginHistoryTo = $('#login-history-to');
const loginHistorySync = $('#login-history-sync');
const loginHistoryExport = $('#login-history-export');
const loginHistoryList = $('#login-history-list');

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
  if (!response.ok) throw new Error((await response.text()) || `Datenbankfehler (${response.status})`);
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
}

function normalizeQuestion(row) {
  return {
    id: Number(row.id),
    text: row.text || '',
    category: row.category || null,
    image: row.image || null,
    answers: Array.isArray(row.answers) ? row.answers.filter(answer => answer !== null && answer !== '') : [],
    correctIndex: Number.isInteger(Number(row.correct_index)) ? Number(row.correct_index) : 0,
    questionType: row.question_type === 'calculation' ? 'calculation' : 'multiple_choice',
    correctValue: row.correct_value === null || row.correct_value === undefined ? null : Number(row.correct_value),
    answerUnit: row.answer_unit || '',
    tolerance: Number(row.tolerance) || 0,
    solutionPath: row.solution_path || ''
  };
}

async function loadProfiles() {
  try {
    const rows = await api('profiles?select=id,display_name,pin_code&order=display_name.asc');
    return rows?.length ? rows : FALLBACK_PROFILES;
  } catch (error) {
    console.warn('Profile konnten nicht geladen werden.', error);
    return FALLBACK_PROFILES;
  }
}

async function loadQuestions() {
  const rows = await api('questions?select=*&order=created_at.desc');
  return (rows || []).map(normalizeQuestion);
}

async function loadPersonalStats() {
  if (!currentProfile) return;
  try {
    const rows = await api(`user_question_stats?select=question_id,correct_count,wrong_count,last_answered_at&profile_id=eq.${currentProfile.id}`);
    personalStats = new Map((rows || []).map(row => [Number(row.question_id), {
      correct: Number(row.correct_count) || 0,
      wrong: Number(row.wrong_count) || 0,
      lastAnsweredAt: row.last_answered_at || null
    }]));
  } catch (error) {
    console.warn('Statistik konnte nicht geladen werden.', error);
    personalStats = new Map();
  }
}

async function loadFavorites() {
  if (!currentProfile) return;
  try {
    const rows = await api(`user_question_favorites?select=question_id&profile_id=eq.${currentProfile.id}`);
    favoriteQuestionIds = new Set((rows || []).map(row => Number(row.question_id)));
  } catch (error) {
    console.warn('Merkliste konnte nicht geladen werden.', error);
    favoriteQuestionIds = new Set();
  }
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
      question_type: question.questionType || 'multiple_choice',
      correct_value: question.correctValue,
      answer_unit: question.answerUnit || null,
      tolerance: question.tolerance || 0,
      solution_path: question.solutionPath || null,
      stats_correct: 0,
      stats_wrong: 0
    })
  });
  return rows?.[0];
}

async function deleteQuestion(id) {
  await api(`questions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function savePersonalStat(questionId, stats) {
  await api('user_question_stats', {
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
}

async function resetPersonalStats() {
  await api(`user_question_stats?profile_id=eq.${currentProfile.id}`, { method: 'DELETE' });
  personalStats = new Map();
}

function isFavorite(id) {
  return favoriteQuestionIds.has(Number(id));
}

async function toggleFavorite(id) {
  if (!currentProfile) return;
  const questionId = Number(id);
  try {
    if (isFavorite(questionId)) {
      await api(`user_question_favorites?profile_id=eq.${currentProfile.id}&question_id=eq.${questionId}`, { method: 'DELETE' });
      favoriteQuestionIds.delete(questionId);
    } else {
      await api('user_question_favorites', {
        method: 'POST',
        body: JSON.stringify({ profile_id: currentProfile.id, question_id: questionId })
      });
      favoriteQuestionIds.add(questionId);
    }
    renderQuestionsList();
    renderStatistics();
  } catch (error) {
    console.error(error);
    alert('Die Merkliste konnte nicht gespeichert werden.');
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Das Bild ist ungültig.'));
      image.onload = () => {
        const maxSize = 1600;
        let width = image.width;
        let height = image.height;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Bild konnte nicht komprimiert werden.')), 'image/jpeg', 0.82);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImageToStorage(file) {
  const blob = await compressImage(file);
  const objectPath = `questions/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false'
    },
    body: blob
  });
  if (!response.ok) throw new Error((await response.text()) || 'Bild-Upload wurde abgelehnt.');
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${objectPath}`;
}

function loadTheme() {
  const theme = localStorage.getItem('examAppTheme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('.theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function fillLoginNames() {
  loginName.innerHTML = '<option value="">Name auswählen …</option>' + profiles
    .map(profile => `<option value="${profile.id}">${escapeHtml(profile.display_name)}</option>`)
    .join('');
  const saved = localStorage.getItem('examAppProfileId');
  if (saved) loginName.value = saved;
}

function extractCategories() {
  categories = [...new Set(questions.map(question => question.category?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de'));
}

function setSelectOptions(select, oldValue = '') {
  if (!select) return;
  select.innerHTML = '<option value="">Alle Kategorien</option>' + categories
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join('');
  if (categories.includes(oldValue)) select.value = oldValue;
}

function renderCategoryFilters() {
  setSelectOptions(filterCategory, filterCategory?.value);
  setSelectOptions(quizCategoryFilter, quizCategoryFilter?.value);
  setSelectOptions(statsFilterCategory, statsFilterCategory?.value);
  setSelectOptions(examCategoryFilter, examCategoryFilter?.value);
}

function renderCategorySuggestions() {
  if (!categorySuggestions) return;
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

function showLogin() {
  loginPin.value = '';
  loginError.textContent = '';
  loginOverlay.classList.remove('hidden');
}

function hideLogin() {
  loginOverlay.classList.add('hidden');
}

function showSection(section) {
  const sections = {
    editor: editorSection,
    quiz: quizSection,
    exam: examSection,
    logins: loginHistorySection,
    stats: statsSection
  };
  const buttons = {
    editor: btnEditor,
    quiz: btnQuiz,
    exam: btnExam,
    logins: btnLogins,
    stats: btnStats
  };
  Object.entries(sections).forEach(([name, element]) => {
    if (element) element.style.display = name === section ? 'block' : 'none';
    if (buttons[name]) buttons[name].classList.toggle('active', name === section);
  });
  if (section === 'quiz') showQuizStart();
  if (section === 'exam') showExamStart();
  if (section === 'stats') renderStatistics();
  if (section === 'logins') renderLoginHistory();
}

function resetAnswersToDefault() {
  answersContainer.innerHTML = '';
  for (let index = 0; index < 4; index++) addAnswerRow(index, index === 0);
  updateRemoveButtons();
}

function addAnswerRow(index, checked = false) {
  const row = document.createElement('div');
  row.className = 'answer-row';
  row.innerHTML = `
    <input type="text" class="answer-input" placeholder="Antwort ${index + 1}" required />
    <label class="correct-choice"><input type="radio" name="correct-answer" value="${index}" ${checked ? 'checked' : ''} /> Richtig</label>
    <button type="button" class="remove-answer" aria-label="Antwort entfernen">&times;</button>`;
  answersContainer.appendChild(row);
}

function updateRemoveButtons() {
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
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

function answerListHtml(question) {
  if (question.questionType === 'calculation') {
    const unit = question.answerUnit ? ` ${escapeHtml(question.answerUnit)}` : '';
    return `<p class="muted-text">Rechenaufgabe: Lösung ${question.correctValue ?? '—'}${unit}</p>`;
  }
  return `<ul>${question.answers.map((answer, index) => `<li>${index === question.correctIndex ? '●' : '○'} ${escapeHtml(answer)}</li>`).join('')}</ul>`;
}

function renderQuestionsList() {
  if (!questionsList) return;
  const category = filterCategory?.value || '';
  const visible = category ? questions.filter(question => question.category === category) : questions;
  if (questionCount) questionCount.textContent = `${visible.length} von ${questions.length} Fragen`;
  if (!visible.length) {
    questionsList.innerHTML = '<div class="empty-stats">Noch keine Fragen in dieser Kategorie.</div>';
    return;
  }
  questionsList.innerHTML = visible.map((question, index) => {
    const badge = question.category ? `<span class="category-badge">${escapeHtml(question.category)}</span>` : '';
    const image = question.image ? `<img src="${escapeHtml(question.image)}" alt="Fragebild" loading="lazy" />` : '';
    return `<article class="question-card">
      <div class="question-card-header"><strong>Frage ${index + 1}</strong><div class="question-card-actions">${badge}<button class="favorite-button ${isFavorite(question.id) ? 'active' : ''}" type="button" data-favorite-id="${question.id}" title="Merkliste">${isFavorite(question.id) ? '★' : '☆'}</button></div></div>
      <p>${escapeHtml(question.text)}</p>${image}${answerListHtml(question)}
      <button class="delete-question" type="button" data-id="${question.id}">Frage löschen</button>
    </article>`;
  }).join('');
  questionsList.querySelectorAll('[data-favorite-id]').forEach(button => button.addEventListener('click', () => toggleFavorite(button.dataset.favoriteId)));
  questionsList.querySelectorAll('.delete-question').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Möchtest du diese Frage für alle löschen?')) return;
    try {
      await deleteQuestion(button.dataset.id);
      questions = questions.filter(question => question.id !== Number(button.dataset.id));
      favoriteQuestionIds.delete(Number(button.dataset.id));
      personalStats.delete(Number(button.dataset.id));
      extractCategories();
      renderCategoryFilters();
      renderCategorySuggestions();
      renderQuestionsList();
      renderStatistics();
    } catch (error) {
      console.error(error);
      alert('Die Frage konnte nicht gelöscht werden.');
    }
  }));
}

function getPerformance(question) {
  const stored = personalStats.get(Number(question.id));
  const correct = Number(stored?.correct) || 0;
  const wrong = Number(stored?.wrong) || 0;
  const answered = correct + wrong;
  return { correct, wrong, answered, accuracy: answered ? Math.round(correct / answered * 100) : null };
}

function createWeakQueue(source) {
  return source.flatMap(question => {
    const stats = getPerformance(question);
    const copies = stats.answered === 0 ? 2 : stats.accuracy < 40 ? 4 : stats.accuracy < 70 ? 3 : stats.accuracy < 90 ? 2 : 1;
    return Array(copies).fill(question);
  });
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const random = Math.floor(Math.random() * (index + 1));
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

function selectedQuestions(category, mode) {
  let selected = category ? questions.filter(question => question.category === category) : [...questions];
  if (mode === 'favorites') selected = selected.filter(question => isFavorite(question.id));
  if (mode === 'weak') selected = createWeakQueue(selected);
  return shuffle(selected);
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

function startQuiz() {
  quizQueue = selectedQuestions(quizCategoryFilter.value, quizModeFilter.value);
  if (!quizQueue.length) {
    alert(quizModeFilter.value === 'favorites' ? 'Deine Merkliste enthält für diese Auswahl noch keine Fragen.' : 'Für diese Auswahl gibt es keine Fragen.');
    return;
  }
  quizResults = [];
  currentQuestionIndex = 0;
  score = 0;
  showQuizActive();
  showQuestion();
}

function showQuestion() {
  const question = quizQueue[currentQuestionIndex];
  quizProgress.textContent = `Frage ${currentQuestionIndex + 1} von ${quizQueue.length}`;
  quizCategoryBadge.textContent = question.category || 'Ohne Kategorie';
  quizQuestionText.textContent = question.text;
  quizQuestionImage.style.display = question.image ? 'block' : 'none';
  quizQuestionImage.src = question.image || '';
  quizAnswers.innerHTML = '';
  quizFeedback.className = 'quiz-feedback';
  quizFeedback.textContent = '';
  nextQuestionBtn.style.display = 'none';
  renderInteractiveAnswer(question, quizAnswers, result => answerQuizQuestion(question, result));
}

function renderInteractiveAnswer(question, container, onAnswer) {
  if (question.questionType === 'calculation') {
    const wrapper = document.createElement('div');
    const unit = question.answerUnit ? ` (${question.answerUnit})` : '';
    wrapper.innerHTML = `<label for="numeric-answer">Deine Lösung${escapeHtml(unit)}</label><div class="calculation-answer"><input id="numeric-answer" type="text" inputmode="decimal" placeholder="z. B. 12,5" /><button type="button" class="quiz-answer-btn">Antwort prüfen</button></div>`;
    const input = wrapper.querySelector('input');
    const button = wrapper.querySelector('button');
    const submit = () => {
      const value = Number(String(input.value).trim().replace(',', '.'));
      if (!Number.isFinite(value)) { input.focus(); return; }
      button.disabled = true;
      input.disabled = true;
      onAnswer({ type: 'calculation', value, button });
    };
    button.addEventListener('click', submit);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    container.appendChild(wrapper);
    return;
  }
  shuffle(question.answers.map((answer, originalIndex) => ({ answer, originalIndex }))).forEach(item => {
    const button = document.createElement('button');
    button.className = 'quiz-answer-btn';
    button.type = 'button';
    button.textContent = item.answer;
    button.addEventListener('click', () => onAnswer({ type: 'choice', index: item.originalIndex, button }));
    container.appendChild(button);
  });
}

async function answerQuizQuestion(question, result) {
  const buttons = [...quizAnswers.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  let correct = false;
  if (result.type === 'calculation') {
    correct = Math.abs(result.value - question.correctValue) <= question.tolerance;
  } else {
    correct = result.index === question.correctIndex;
  }
  const stats = getPerformance(question);
  if (correct) {
    stats.correct++;
    score++;
    result.button.classList.add('correct');
    quizFeedback.textContent = 'Richtig! 🎉';
    quizFeedback.className = 'quiz-feedback show correct';
  } else {
    stats.wrong++;
    result.button.classList.add('wrong');
    if (result.type === 'choice') {
      [...quizAnswers.querySelectorAll('.quiz-answer-btn')].forEach(button => {
        if (button.textContent === question.answers[question.correctIndex]) button.classList.add('correct');
      });
    }
    const solution = question.questionType === 'calculation'
      ? ` Die richtige Lösung ist ${question.correctValue}${question.answerUnit ? ` ${question.answerUnit}` : ''}.`
      : ' Die richtige Antwort ist markiert.';
    quizFeedback.textContent = `Leider falsch.${solution}${question.solutionPath ? ` Lösungsweg: ${question.solutionPath}` : ''}`;
    quizFeedback.className = 'quiz-feedback show wrong';
  }
  personalStats.set(question.id, stats);
  quizResults.push({ category: question.category || 'Ohne Kategorie', correct });
  try { await savePersonalStat(question.id, stats); } catch (error) { console.error(error); }
  nextQuestionBtn.style.display = 'inline-block';
}

function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= quizQueue.length) showQuizEnd();
  else showQuestion();
}

function showQuizEnd() {
  quizStart.style.display = 'none';
  quizActive.style.display = 'none';
  quizEnd.style.display = 'block';
  quizResult.textContent = `Du hast ${score} von ${quizQueue.length} Fragen richtig beantwortet.`;
  renderCategoryResult(quizCategoryResult, quizResults);
  renderStatistics();
}

function renderCategoryResult(container, results) {
  const groups = {};
  results.forEach(item => {
    if (!groups[item.category]) groups[item.category] = { correct: 0, total: 0 };
    groups[item.category].total++;
    if (item.correct) groups[item.category].correct++;
  });
  const rows = Object.entries(groups).map(([category, data]) => `<li>${escapeHtml(category)}: ${data.correct}/${data.total} richtig</li>`).join('');
  container.innerHTML = rows ? `<h4>Ergebnis nach Kategorien</h4><ul>${rows}</ul>` : '';
}

function renderStatistics() {
  if (!currentProfile) return;
  const totals = questions.reduce((sum, question) => {
    const stats = getPerformance(question);
    sum.correct += stats.correct;
    sum.wrong += stats.wrong;
    return sum;
  }, { correct: 0, wrong: 0 });
  const answered = totals.correct + totals.wrong;
  statTotalQuestions.textContent = questions.length;
  statTotalAnswered.textContent = answered;
  statCorrect.textContent = totals.correct;
  statWrong.textContent = totals.wrong;
  statAccuracy.textContent = `${answered ? Math.round(totals.correct / answered * 100) : 0}%`;
  statsUserInfo.textContent = `Persönliche Lernergebnisse von ${currentProfile.display_name}. ${favoriteQuestionIds.size} Fragen sind in deiner Merkliste.`;
  renderWeakQuestions();
  renderCategoryStats();
  renderDetailedStats();
}

function createStatCard(question) {
  const stats = getPerformance(question);
  const status = stats.answered === 0 ? 'neutral' : stats.wrong > stats.correct ? 'weak' : 'good';
  const accuracy = stats.accuracy === null ? 'Noch nicht beantwortet' : `${stats.accuracy}% richtig`;
  return `<article class="question-stat-card ${status}"><div class="question-stat-header"><strong>Frage</strong><span class="category-badge">${escapeHtml(question.category || 'Ohne Kategorie')}</span></div><p class="question-stat-text">${escapeHtml(question.text)}</p><div class="question-stat-values"><span class="stat-pill correct">✓ ${stats.correct} richtig</span><span class="stat-pill wrong">✕ ${stats.wrong} falsch</span><span class="stat-pill accuracy">${accuracy}</span></div></article>`;
}

function renderWeakQuestions() {
  const weak = questions.filter(question => getPerformance(question).wrong > 0).sort((a, b) => getPerformance(b).wrong - getPerformance(a).wrong);
  weakQuestionsList.innerHTML = weak.length ? weak.map(createStatCard).join('') : '<div class="empty-stats">Noch keine falsch beantworteten Fragen.</div>';
}

function renderCategoryStats() {
  const data = {};
  questions.forEach(question => {
    const category = question.category || 'Ohne Kategorie';
    const stats = getPerformance(question);
    if (!data[category]) data[category] = { correct: 0, wrong: 0, count: 0 };
    data[category].correct += stats.correct;
    data[category].wrong += stats.wrong;
    data[category].count++;
  });
  categoryStatsList.innerHTML = Object.entries(data).map(([category, data]) => {
    const answered = data.correct + data.wrong;
    const accuracy = answered ? Math.round(data.correct / answered * 100) : 0;
    const level = accuracy < 50 ? 'low' : accuracy < 75 ? 'medium' : '';
    const text = answered ? `${data.correct}/${answered} richtig (${accuracy}%)` : `${data.count} Fragen, noch nicht beantwortet`;
    return `<div class="category-stat-row"><span class="category-stat-name">${escapeHtml(category)}</span><div class="progress-bar"><div class="progress-bar-fill ${level}" style="width:${accuracy}%"></div></div><span class="category-stat-percent">${text}</span></div>`;
  }).join('') || '<div class="empty-stats">Noch keine Fragen vorhanden.</div>';
}

function renderDetailedStats() {
  const category = statsFilterCategory.value;
  const filter = statsFilterPerformance.value;
  let visible = category ? questions.filter(question => question.category === category) : [...questions];
  if (filter === 'weak') visible = visible.filter(question => { const stats = getPerformance(question); return stats.wrong > stats.correct; });
  if (filter === 'good') visible = visible.filter(question => { const stats = getPerformance(question); return stats.answered > 0 && stats.correct >= stats.wrong; });
  visible.sort((a, b) => getPerformance(b).wrong - getPerformance(a).wrong);
  allQuestionsStats.innerHTML = visible.length ? visible.map(createStatCard).join('') : '<div class="empty-stats">Keine Fragen für diesen Filter vorhanden.</div>';
}

function showExamStart() {
  clearInterval(examTimerId);
  examStart.style.display = 'block';
  examActive.style.display = 'none';
  examEnd.style.display = 'none';
}

function formatTime(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function startExam() {
  examQueue = selectedQuestions(examCategoryFilter.value, examModeFilter.value);
  if (!examQueue.length) { alert('Für diese Auswahl gibt es keine Fragen.'); return; }
  examResults = [];
  examQuestionIndex = 0;
  examScore = 0;
  examRemainingSeconds = Math.max(1, Number(examDuration.value) || 60) * 60;
  examStart.style.display = 'none';
  examActive.style.display = 'block';
  examEnd.style.display = 'none';
  examTimer.textContent = formatTime(examRemainingSeconds);
  clearInterval(examTimerId);
  examTimerId = setInterval(() => {
    examRemainingSeconds--;
    examTimer.textContent = formatTime(examRemainingSeconds);
    if (examRemainingSeconds <= 0) finishExam();
  }, 1000);
  showExamQuestion();
}

function showExamQuestion() {
  const question = examQueue[examQuestionIndex];
  examProgress.textContent = `Frage ${examQuestionIndex + 1} von ${examQueue.length}`;
  examCategoryBadge.textContent = question.category || 'Ohne Kategorie';
  examQuestionText.textContent = question.text;
  examQuestionImage.style.display = question.image ? 'block' : 'none';
  examQuestionImage.src = question.image || '';
  examAnswers.innerHTML = '';
  examFeedback.className = 'quiz-feedback';
  examFeedback.textContent = '';
  examNextBtn.style.display = 'none';
  renderInteractiveAnswer(question, examAnswers, result => answerExamQuestion(question, result));
}

async function answerExamQuestion(question, result) {
  [...examAnswers.querySelectorAll('button')].forEach(button => { button.disabled = true; });
  const correct = result.type === 'calculation'
    ? Math.abs(result.value - question.correctValue) <= question.tolerance
    : result.index === question.correctIndex;
  const stats = getPerformance(question);
  if (correct) { stats.correct++; examScore++; result.button.classList.add('correct'); }
  else { stats.wrong++; result.button.classList.add('wrong'); }
  personalStats.set(question.id, stats);
  examResults.push({ category: question.category || 'Ohne Kategorie', correct });
  try { await savePersonalStat(question.id, stats); } catch (error) { console.error(error); }
  examFeedback.textContent = correct ? 'Antwort gespeichert.' : 'Antwort gespeichert.';
  examFeedback.className = `quiz-feedback show ${correct ? 'correct' : 'wrong'}`;
  examNextBtn.style.display = 'inline-block';
}

function nextExamQuestion() {
  examQuestionIndex++;
  if (examQuestionIndex >= examQueue.length) finishExam();
  else showExamQuestion();
}

function finishExam() {
  clearInterval(examTimerId);
  examStart.style.display = 'none';
  examActive.style.display = 'none';
  examEnd.style.display = 'block';
  examResult.textContent = `Ergebnis: ${examScore} von ${examQueue.length} Fragen richtig.`;
  renderCategoryResult(examCategoryResult, examResults);
  renderStatistics();
}

function printExam() {
  const includeAnswers = examPrintAnswers?.checked;
  const selected = selectedQuestions(examCategoryFilter.value, examModeFilter.value);
  if (!selected.length) { alert('Für diese Auswahl gibt es keine Fragen.'); return; }
  const body = selected.map((question, index) => `<section><h3>${index + 1}. ${escapeHtml(question.text)}</h3>${question.image ? `<img src="${escapeHtml(question.image)}" alt="Fragebild">` : ''}<ol>${question.questionType === 'calculation' ? `<li>Rechenaufgabe: Trage dein Ergebnis ein.</li>` : question.answers.map(answer => `<li>${escapeHtml(answer)}</li>`).join('')}</ol>${includeAnswers ? `<p><strong>Lösung:</strong> ${question.questionType === 'calculation' ? `${question.correctValue}${question.answerUnit ? ` ${escapeHtml(question.answerUnit)}` : ''}` : escapeHtml(question.answers[question.correctIndex] || '')}</p>` : ''}</section>`).join('');
  const popup = window.open('', '_blank');
  if (!popup) { alert('Bitte erlaube Pop-ups, um die Prüfung zu drucken.'); return; }
  popup.document.write(`<!doctype html><html lang="de"><head><title>Prüfungssimulation</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111}section{break-inside:avoid;margin:0 0 28px}img{max-width:100%;max-height:300px}li{margin:7px 0}</style></head><body><h1>Prüfungssimulation</h1>${body}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function loadLoginEvents() {
  try { return JSON.parse(localStorage.getItem('examAppLoginEvents') || '[]'); } catch { return []; }
}

function saveLoginEvents(events) {
  localStorage.setItem('examAppLoginEvents', JSON.stringify(events));
}

function addLoginEvent(profile) {
  const events = loadLoginEvents();
  events.unshift({ profileId: profile.id, displayName: profile.display_name, timestamp: new Date().toISOString() });
  saveLoginEvents(events.slice(0, 500));
}

function renderLoginHistory() {
  if (!loginHistoryList) return;
  const profileValue = loginHistoryProfile?.value || '';
  const from = loginHistoryFrom?.value ? new Date(`${loginHistoryFrom.value}T00:00:00`) : null;
  const to = loginHistoryTo?.value ? new Date(`${loginHistoryTo.value}T23:59:59`) : null;
  const events = loadLoginEvents().filter(event => {
    const time = new Date(event.timestamp);
    return (!profileValue || String(event.profileId) === profileValue) && (!from || time >= from) && (!to || time <= to);
  });
  loginHistoryList.innerHTML = events.length ? events.map(event => `<article class="question-card"><strong>${escapeHtml(event.displayName)}</strong><p class="muted-text">Anmeldung: ${new Date(event.timestamp).toLocaleString('de-DE')}</p></article>`).join('') : '<div class="empty-stats">Keine Anmeldeereignisse für diesen Filter.</div>';
}

function populateLoginHistoryProfiles() {
  if (!loginHistoryProfile) return;
  loginHistoryProfile.innerHTML = '<option value="">Alle</option>' + profiles.map(profile => `<option value="${profile.id}">${escapeHtml(profile.display_name)}</option>`).join('');
}

function exportLoginHistory() {
  const rows = loadLoginEvents();
  const csv = ['Name;Zeitpunkt', ...rows.map(event => `"${String(event.displayName).replace(/"/g, '""')}";"${new Date(event.timestamp).toLocaleString('de-DE')}"`)].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'anmeldeverlauf.csv';
  link.click();
  URL.revokeObjectURL(url);
}

async function init() {
  loadTheme();
  profiles = await loadProfiles();
  fillLoginNames();
  populateLoginHistoryProfiles();
  try {
    questions = await loadQuestions();
  } catch (error) {
    console.error(error);
    questions = [];
    loginError.textContent = 'Fragen konnten nicht geladen werden. Prüfe Internetverbindung und Supabase-Einstellungen.';
  }
  extractCategories();
  renderCategoryFilters();
  renderCategorySuggestions();
  renderQuestionsList();
  showQuizStart();
  showExamStart();
  showLogin();
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = profiles.find(item => String(item.id) === loginName.value);
  const pin = loginPin.value.trim();
  if (!profile || !/^\d{4}$/.test(pin) || profile.pin_code !== pin) {
    loginError.textContent = 'Name oder PIN ist nicht korrekt.';
    loginPin.value = '';
    loginPin.focus();
    return;
  }
  loginSubmit.disabled = true;
  try {
    currentProfile = profile;
    await Promise.all([loadPersonalStats(), loadFavorites()]);
    localStorage.setItem('examAppProfileId', String(profile.id));
    currentUserLabel.textContent = `Angemeldet: ${profile.display_name}`;
    addLoginEvent(profile);
    hideLogin();
    renderQuestionsList();
    renderStatistics();
    renderLoginHistory();
  } finally {
    loginSubmit.disabled = false;
  }
});

switchProfileBtn.addEventListener('click', () => {
  currentProfile = null;
  personalStats = new Map();
  favoriteQuestionIds = new Set();
  localStorage.removeItem('examAppProfileId');
  showLogin();
});

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('examAppTheme', theme);
  $('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
});

btnEditor.addEventListener('click', () => showSection('editor'));
btnQuiz.addEventListener('click', () => showSection('quiz'));
btnExam?.addEventListener('click', () => showSection('exam'));
btnLogins?.addEventListener('click', () => showSection('logins'));
btnStats.addEventListener('click', () => showSection('stats'));

questionImage.addEventListener('change', event => {
  const file = event.target.files?.[0];
  imagePreview.innerHTML = '';
  selectedImageFile = null;
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
    alert('Bitte verwende eine Bilddatei unter 10 MB.');
    questionImage.value = '';
    return;
  }
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = loadEvent => {
    const image = document.createElement('img');
    image.src = loadEvent.target.result;
    image.alt = 'Bildvorschau';
    imagePreview.appendChild(image);
  };
  reader.readAsDataURL(file);
});

addAnswerBtn.addEventListener('click', () => {
  addAnswerRow(answersContainer.querySelectorAll('.answer-row').length);
  updateRemoveButtons();
});

answersContainer.addEventListener('click', event => {
  if (!event.target.classList.contains('remove-answer')) return;
  if (answersContainer.querySelectorAll('.answer-row').length <= 2) return;
  event.target.closest('.answer-row').remove();
  reindexAnswers();
  updateRemoveButtons();
});

clearFormBtn.addEventListener('click', () => {
  questionForm.reset();
  imagePreview.innerHTML = '';
  selectedImageFile = null;
  resetAnswersToDefault();
});

questionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const rows = [...answersContainer.querySelectorAll('.answer-row')];
  const answers = rows.map(row => row.querySelector('.answer-input').value.trim());
  const correctIndex = rows.findIndex(row => row.querySelector('input[type="radio"]').checked);
  if (!questionText.value.trim() || answers.some(answer => !answer) || correctIndex < 0) {
    alert('Bitte fülle die Frage, alle Antworten und die richtige Antwort aus.');
    return;
  }
  const button = questionForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = selectedImageFile ? 'Bild wird hochgeladen …' : 'Wird gespeichert …';
  try {
    const image = selectedImageFile ? await uploadImageToStorage(selectedImageFile) : null;
    const saved = await saveQuestion({ text: questionText.value.trim(), category: questionCategory.value.trim() || null, image, answers, correctIndex, questionType: 'multiple_choice' });
    questions.unshift(normalizeQuestion(saved));
    extractCategories();
    renderCategoryFilters();
    renderCategorySuggestions();
    renderQuestionsList();
    questionForm.reset();
    imagePreview.innerHTML = '';
    selectedImageFile = null;
    resetAnswersToDefault();
  } catch (error) {
    console.error(error);
    alert('Speichern fehlgeschlagen. Prüfe bei Bildern die Storage-Regeln des Buckets question-images.');
  } finally {
    button.disabled = false;
    button.textContent = 'Frage speichern';
  }
});

filterCategory.addEventListener('change', renderQuestionsList);
startQuizBtn.addEventListener('click', startQuiz);
restartQuizBtn.addEventListener('click', startQuiz);
quitQuizBtn.addEventListener('click', showQuizStart);
nextQuestionBtn.addEventListener('click', nextQuestion);
statsFilterCategory.addEventListener('change', renderDetailedStats);
statsFilterPerformance.addEventListener('change', renderDetailedStats);
resetStatsBtn.addEventListener('click', async () => {
  if (!currentProfile || !confirm('Möchtest du wirklich nur deine persönliche Statistik zurücksetzen?')) return;
  try { await resetPersonalStats(); renderStatistics(); } catch (error) { console.error(error); alert('Die Statistik konnte nicht zurückgesetzt werden.'); }
});
startExamBtn?.addEventListener('click', startExam);
restartExamBtn?.addEventListener('click', startExam);
quitExamBtn?.addEventListener('click', finishExam);
examNextBtn?.addEventListener('click', nextExamQuestion);
examPrintBtn?.addEventListener('click', printExam);
loginHistoryProfile?.addEventListener('change', renderLoginHistory);
loginHistoryFrom?.addEventListener('change', renderLoginHistory);
loginHistoryTo?.addEventListener('change', renderLoginHistory);
loginHistorySync?.addEventListener('click', () => { renderLoginHistory(); alert('Der Anmeldeverlauf wird derzeit lokal im Browser gespeichert.'); });
loginHistoryExport?.addEventListener('click', exportLoginHistory);

init();
