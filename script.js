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

const $ = selector => document.querySelector(selector);

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
    const error = await response.text();
    throw new Error(error || `Datenbankfehler (${response.status})`);
  }

  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
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

        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Bild konnte nicht komprimiert werden.'));
            return;
          }
          resolve(blob);
        }, 'image/jpeg', 0.82);
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function init() {
  loadTheme();
  profiles = await loadProfiles();
  fillLoginNames();

  try {
    questions = await loadQuestions();
  } catch (error) {
    console.error(error);
    questions = [];
    loginError.textContent = 'Fragen konnten gerade nicht geladen werden. Du kannst dich trotzdem anmelden.';
  }

  extractCategories();
  renderCategoryFilters();
  renderCategorySuggestions();
  renderQuestionsList();
  showLogin();
}

function fillLoginNames() {
  loginName.innerHTML = '<option value="">Name auswählen …</option>' + profiles
    .map(profile => `<option value="${profile.id}">${escapeHtml(profile.display_name)}</option>`)
    .join('');

  const savedProfileId = localStorage.getItem('examAppProfileId');
  if (savedProfileId) loginName.value = savedProfileId;
}

function showLogin() {
  loginPin.value = '';
  loginError.textContent = '';
  loginOverlay.classList.remove('hidden');
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
    await Promise.all([loadPersonalStats(), loadFavorites()]);
    localStorage.setItem('examAppProfileId', String(profile.id));
    currentUserLabel.textContent = `Angemeldet: ${profile.display_name}`;
    statsUserInfo.textContent = `Persönliche Lernergebnisse von ${profile.display_name}. ${favoriteQuestionIds.size} Fragen sind in deiner Merkliste.`;
    hideLogin();
    renderQuestionsList();
    renderStatistics();
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Anmelden';
  }
});

switchProfileBtn.addEventListener('click', () => {
  currentProfile = null;
  personalStats = new Map();
  favoriteQuestionIds = new Set();
  localStorage.removeItem('examAppProfileId');
  showLogin();
});

function loadTheme() {
  const theme = localStorage.getItem('examAppTheme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  $('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('examAppTheme', theme);
  $('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
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
btnQuiz.addEventListener('click', () => {
  showSection('quiz');
  showQuizStart();
});
btnStats.addEventListener('click', () => {
  showSection('stats');
  renderStatistics();
});

questionImage.addEventListener('change', event => {
  const file = event.target.files?.[0];
  imagePreview.innerHTML = '';
  selectedImageFile = null;
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Bitte wähle eine Bilddatei aus.');
    questionImage.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Das Bild ist zu groß. Bitte verwende ein Bild unter 10 MB.');
    questionImage.value = '';
    return;
  }

  selectedImageFile = file;
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
    button.type = 'button';
    button.className = 'category-suggestion';
    button.textContent = category;
    button.addEventListener('click', () => { questionCategory.value = category; });
    categorySuggestions.appendChild(button);
  });
}

function renderCategoryFilters() {
  const oldEditorValue = filterCategory.value;
  const oldQuizValue = quizCategoryFilter.value;
  const oldStatsValue = statsFilterCategory.value;
  const options = '<option value="">Alle Kategorien</option>' + categories
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join('');

  filterCategory.innerHTML = options;
  quizCategoryFilter.innerHTML = options;
  statsFilterCategory.innerHTML = options;
  filterCategory.value = categories.includes(oldEditorValue) ? oldEditorValue : '';
  quizCategoryFilter.value = categories.includes(oldQuizValue) ? oldQuizValue : '';
  statsFilterCategory.value = categories.includes(oldStatsValue) ? oldStatsValue : '';
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
    alert('Bitte fülle die Frage, alle Antworten und die richtige Antwort aus.');
    return;
  }

  const submitButton = questionForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = selectedImageFile ? 'Bild wird hochgeladen …' : 'Wird gespeichert …';

  try {
    const imageUrl = selectedImageFile ? await uploadImageToStorage(selectedImageFile) : null;
    const saved = await saveQuestion({
      text: questionText.value.trim(),
      category: questionCategory.value.trim() || null,
      image: imageUrl,
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
    selectedImageFile = null;
    resetAnswersToDefault();
  } catch (error) {
    console.error(error);
    alert('Speichern fehlgeschlagen. Falls es beim Bild passiert: Prüfe in Supabase Storage, ob beim Bucket question-images Uploads erlaubt sind.');
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
  selectedImageFile = null;
  resetAnswersToDefault();
});

filterCategory.addEventListener('change', renderQuestionsList);

function renderQuestionsList() {
  const category = filterCategory.value;
  const visible = category ? questions.filter(question => question.category === category) : questions;
  questionCount.textContent = `${visible.length} von ${questions.length} Fragen`;

  if (!visible.length) {
    questionsList.innerHTML = '<div class="empty-stats">Noch keine Fragen in dieser Kategorie.</div>';
    return;
  }

  questionsList.innerHTML = visible.map((question, index) => {
    const categoryBadge = question.category ? `<span class="category-badge">${escapeHtml(question.category)}</span>` : '';
    const image = question.image ? `<img src="${question.image}" alt="Fragebild" />` : '';
    const answers = question.answers
      .map((answer, answerIndex) => `<li>${answerIndex === question.correctIndex ? '●' : '○'} ${escapeHtml(answer)}</li>`)
      .join('');
    const favorite = isFavorite(question.id);

    return `
      <article class="question-card">
        <div class="question-card-header">
          <strong>Frage ${index + 1}</strong>
          <div class="question-card-actions">
            ${categoryBadge}
            <button class="favorite-button ${favorite ? 'active' : ''}" type="button" data-favorite-id="${question.id}" title="${favorite ? 'Aus Merkliste entfernen' : 'Zur Merkliste hinzufügen'}">${favorite ? '★' : '☆'}</button>
          </div>
        </div>
        <p>${escapeHtml(question.text)}</p>
        ${image}
        <ul>${answers}</ul>
        <button class="delete-question" type="button" data-id="${question.id}">Frage löschen</button>
      </article>
    `;
  }).join('');

  questionsList.querySelectorAll('[data-favorite-id]').forEach(button => {
    button.addEventListener('click', () => toggleFavorite(button.dataset.favoriteId));
  });

  questionsList.querySelectorAll('.delete-question').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Möchtest du diese Frage für alle löschen?')) return;
      try {
        await deleteQuestion(button.dataset.id);
        questions = questions.filter(question => String(question.id) !== button.dataset.id);
        personalStats.delete(Number(button.dataset.id));
        favoriteQuestionIds.delete(Number(button.dataset.id));
        extractCategories();
        renderCategoryFilters();
        renderCategorySuggestions();
        renderQuestionsList();
        renderStatistics();
      } catch (error) {
        console.error(error);
        alert('Die Frage konnte nicht gelöscht werden.');
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

  if (quizModeFilter.value === 'favorites') {
    selected = selected.filter(question => isFavorite(question.id));
  }

  if (!selected.length) {
    const message = quizModeFilter.value === 'favorites'
      ? 'Deine Merkliste enthält für diese Auswahl noch keine Fragen.'
      : 'Für diese Auswahl gibt es keine Fragen.';
    alert(message);
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
    for (let i = 0; i < repetitions; i++) queue.push(question);
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

  if (question.image) {
    quizQuestionImage.src = question.image;
    quizQuestionImage.style.display = 'block';
  } else {
    quizQuestionImage.style.display = 'none';
  }

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

  const rows = Object.entries(summary)
    .map(([category, data]) => `<li>${escapeHtml(category)}: ${data.correct}/${data.total} richtig</li>`)
    .join('');

  quizCategoryResult.innerHTML = rows ? `<h4>Ergebnis nach Kategorien</h4><ul>${rows}</ul>` : '';
}

statsFilterCategory.addEventListener('change', renderDetailedStats);
statsFilterPerformance.addEventListener('change', renderDetailedStats);

resetStatsBtn.addEventListener('click', async () => {
  if (!currentProfile) return;
  if (!confirm('Möchtest du wirklich nur deine persönliche Statistik zurücksetzen?')) return;

  try {
    await resetPersonalStats();
    renderStatistics();
  } catch (error) {
    console.error(error);
    alert('Die Statistik konnte nicht zurückgesetzt werden.');
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

  const totals = questions.reduce((summary, question) => {
    const stats = getPerformance(question);
    summary.correct += stats.correct;
    summary.wrong += stats.wrong;
    return summary;
  }, { correct: 0, wrong: 0 });

  const answered = totals.correct + totals.wrong;
  statTotalQuestions.textContent = questions.length;
  statTotalAnswered.textContent = answered;
  statCorrect.textContent = totals.correct;
  statWrong.textContent = totals.wrong;
  statAccuracy.textContent = `${answered ? Math.round((totals.correct / answered) * 100) : 0}%`;
  statsUserInfo.textContent = `Persönliche Lernergebnisse von ${currentProfile.display_name}. ${favoriteQuestionIds.size} Fragen sind in deiner Merkliste.`;
  renderWeakQuestions();
  renderCategoryStats();
  renderDetailedStats();
}

function renderWeakQuestions() {
  const weak = questions
    .filter(question => getPerformance(question).wrong > 0)
    .sort((a, b) => getPerformance(b).wrong - getPerformance(a).wrong);

  weakQuestionsList.innerHTML = weak.length
    ? weak.map(createStatCard).join('')
    : '<div class="empty-stats">Noch keine falsch beantworteten Fragen.</div>';
}

function renderCategoryStats() {
  const data = {};
  questions.forEach(question => {
    const category = question.category || 'Ohne Kategorie';
    const stats = getPerformance(question);
    if (!data[category]) data[category] = { correct: 0, wrong: 0, questions: 0 };
    data[category].correct += stats.correct;
    data[category].wrong += stats.wrong;
    data[category].questions++;
  });

  categoryStatsList.innerHTML = Object.entries(data).map(([category, stats]) => {
    const answered = stats.correct + stats.wrong;
    const accuracy = answered ? Math.round((stats.correct / answered) * 100) : 0;
    const level = accuracy < 50 ? 'low' : accuracy < 75 ? 'medium' : '';
    const label = answered ? `${stats.correct}/${answered} richtig (${accuracy}%)` : `${stats.questions} Fragen, noch nicht beantwortet`;
    return `
      <div class="category-stat-row">
        <span class="category-stat-name">${escapeHtml(category)}</span>
        <div class="progress-bar"><div class="progress-bar-fill ${level}" style="width:${accuracy}%"></div></div>
        <span class="category-stat-percent">${label}</span>
      </div>
    `;
  }).join('');
}

function renderDetailedStats() {
  const category = statsFilterCategory.value;
  const filter = statsFilterPerformance.value;
  let visible = category ? questions.filter(question => question.category === category) : [...questions];

  if (filter === 'weak') {
    visible = visible.filter(question => {
      const stats = getPerformance(question);
      return stats.wrong > stats.correct;
    });
  }

  if (filter === 'good') {
    visible = visible.filter(question => {
      const stats = getPerformance(question);
      return stats.answered > 0 && stats.correct >= stats.wrong;
    });
  }

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

  return `
    <article class="question-stat-card ${status}">
      <div class="question-stat-header">
        <strong>Frage</strong>
        <span class="category-badge">${escapeHtml(category)}</span>
      </div>
      <p class="question-stat-text">${escapeHtml(question.text)}</p>
      <div class="question-stat-values">
        <span class="stat-pill correct">✓ ${stats.correct} richtig</span>
        <span class="stat-pill wrong">✕ ${stats.wrong} falsch</span>
        <span class="stat-pill accuracy">${accuracy}</span>
      </div>
    </article>
  `;
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


// cache-bust: updated 2026-08-31T07:22:03.438528Z
