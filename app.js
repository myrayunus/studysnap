/* =============================================
   StudySnap – app.js
   ============================================= */

// ─── PDF.js worker ───────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── DOM refs ────────────────────────────────
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const fileStatus    = document.getElementById('fileStatus');
const fileNameEl    = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const analyzeBtn    = document.getElementById('analyzeBtn');
const spinner       = document.getElementById('spinner');
const resultsGrid   = document.getElementById('resultsGrid');

// Results
const studyTimeEl   = document.getElementById('studyTime');
const difficultyEl  = document.getElementById('difficultyTag');
const summaryList   = document.getElementById('summaryList');
const glossaryList  = document.getElementById('glossaryList');
const examplesList  = document.getElementById('examplesList');

// Flashcards
const carousel      = document.getElementById('flashcardCarousel');
const prevBtn       = document.getElementById('prevCard');
const nextBtn       = document.getElementById('nextCard');
const cardCounter   = document.getElementById('cardCounter');

// Quiz
const quizChat      = document.getElementById('quizChat');
const quizInput     = document.getElementById('quizInput');
const quizSend      = document.getElementById('quizSend');
const scorePanel    = document.getElementById('scorePanel');
const scoreNum      = document.getElementById('scoreNum');
const scoreLabel    = document.getElementById('scoreLabel');
const confidenceStars = document.querySelectorAll('.star-btn');

// ─── State ───────────────────────────────────
let rawText         = '';
let analysisData    = null;
let flashcards      = [];
let currentCard     = 0;
let quizQuestions   = [];
let quizIndex       = 0;
let quizScore       = 0;
let quizActive      = false;
let awaitingAnswer  = false;

// ─── Loading overlay ─────────────────────────
const overlay = document.createElement('div');
overlay.className = 'loading-overlay';
overlay.innerHTML = `<div class="loading-spinner"></div><p class="loading-text" id="loadingText">Analysing your notes…</p>`;
document.body.appendChild(overlay);
const loadingText = document.getElementById('loadingText');

function showLoading(msg = 'Analysing your notes…') {
  loadingText.textContent = msg;
  overlay.classList.add('active');
}
function hideLoading() {
  overlay.classList.remove('active');
}

// ─── Drag & Drop ─────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
removeFileBtn.addEventListener('click', resetUpload);

function handleFile(file) {
  if (!file.name.match(/\.(pdf|txt)$/i)) {
    alert('Please upload a PDF or TXT file.');
    return;
  }
  fileNameEl.textContent = file.name;
  fileStatus.hidden = false;
  dropZone.hidden   = true;
  analyzeBtn.disabled = false;

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    readPDF(file);
  } else {
    readTXT(file);
  }
}

function resetUpload() {
  rawText = '';
  fileInput.value = '';
  fileStatus.hidden = true;
  dropZone.hidden = false;
  analyzeBtn.disabled = true;
  resultsGrid.hidden = true;
}

// ─── PDF Text Extraction ─────────────────────
async function readPDF(file) {
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    rawText = text.trim();
  } catch (err) {
    console.error('PDF read error:', err);
    rawText = '[PDF parsing failed – using demo content]';
  }
}

function readTXT(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => { rawText = e.target.result; resolve(); };
    reader.readAsText(file);
  });
}

// ─── Analyse Button ───────────────────────────
analyzeBtn.addEventListener('click', async () => {
  if (!rawText) {
    // If PDF is still loading, wait a moment
    await new Promise(r => setTimeout(r, 800));
  }
  showLoading('Analysing your notes…');

  // Simulate AI processing delay
  await delay(1800);
  analysisData = generateStudyContent(rawText);

  hideLoading();
  renderResults(analysisData);

  resultsGrid.hidden = false;
  resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ─── AI Content Generator ────────────────────
// Because we're frontend-only we generate contextual mock content
// derived from the actual text when possible.
function generateStudyContent(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordCount = words.length || 500;

  // Estimate study time (avg reading ~200 wpm, study ~1.5x)
  const minutes = Math.max(5, Math.round((wordCount / 200) * 1.5));
  const studyTime = minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;

  // Difficulty heuristic
  const advancedWords = ['algorithm','theorem','derivative','synthesis','hypothesis',
    'equilibrium','quantum','entropy','metabolism','cognition','paradigm','stochastic'];
  const advancedCount = advancedWords.filter(w => text.toLowerCase().includes(w)).length;
  const difficulty = advancedCount >= 4 ? '🔴 Advanced' : advancedCount >= 2 ? '🟡 Intermediate' : '🟢 Beginner';

  // Extract key sentences for summary (take first 7 sentences-ish)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const summarySentences = sentences.slice(0, 7).map(s => s.trim()).filter(s => s.length > 30);

  // Fallback summaries if text is too short
  const summaryFallbacks = [
    'The document introduces key concepts and foundational ideas in the subject area.',
    'Core terminology is defined and contextualised throughout the material.',
    'Several real-world applications are referenced to support understanding.',
    'The content builds progressively from basic principles to more complex ideas.',
    'Critical thinking and active recall are encouraged through structured review.',
    'Key relationships between concepts help form a coherent mental model.',
    'Regular revision of this material will reinforce long-term retention.'
  ];
  const summaryItems = summarySentences.length >= 5
    ? summarySentences.slice(0, 7)
    : summaryFallbacks;

  // Glossary – extract capitalised or repeated notable words
  const glossaryFallback = [
    { term: 'Concept',       def: 'A fundamental idea or principle covered in the lecture.' },
    { term: 'Framework',     def: 'A structured approach or model for understanding a topic.' },
    { term: 'Analysis',      def: 'The process of breaking down information into components.' },
    { term: 'Synthesis',     def: 'Combining elements to form a new, coherent whole.' },
    { term: 'Application',   def: 'The practical use of knowledge in real-world scenarios.' },
  ];
  const glossary = extractGlossary(text) || glossaryFallback;

  // Examples
  const examplesFallback = [
    'Industry professionals apply these principles daily in workplace problem-solving.',
    'Case studies from leading organisations illustrate these concepts in action.',
    'Research papers frequently cite similar frameworks when studying related phenomena.',
    'Students can practise by identifying examples in news articles or current events.',
    'Software engineers and data scientists rely on these ideas to build scalable systems.'
  ];
  const examples = extractExamples(text) || examplesFallback;

  // Flashcards – build Q&A pairs from text
  const fcFallback = [
    { q: 'What is the primary purpose of this lecture material?',  a: 'To introduce core concepts and provide a structured understanding of the subject.' },
    { q: 'How does the framework described help in practice?',     a: 'It provides a repeatable approach to solve problems in the domain.' },
    { q: 'What distinguishes a theory from a hypothesis?',         a: 'A theory has been tested and supported by evidence; a hypothesis is an untested prediction.' },
    { q: 'Why is active recall important when studying?',          a: 'It strengthens memory pathways and improves long-term retention compared to passive re-reading.' },
    { q: 'What does analysis involve in an academic context?',     a: 'Breaking down complex information into smaller parts to understand each component and their relationships.' }
  ];
  const flashcardsData = buildFlashcards(text) || fcFallback;

  // Quiz questions
  const quizFallback = buildFallbackQuiz();
  const quiz = buildQuiz(text) || quizFallback;

  return { studyTime, difficulty, summary: summaryItems, glossary, examples, flashcards: flashcardsData, quiz };
}

// ─── Text Analysis Helpers ───────────────────
function extractGlossary(text) {
  // Find "Term – definition" or "Term: definition" patterns
  const matches = text.match(/([A-Z][a-zA-Z\s]{2,25})[:\–\-]([^.\n]{15,120})/g);
  if (!matches || matches.length < 3) return null;
  return matches.slice(0, 5).map(m => {
    const parts = m.split(/[:\–\-]/);
    return { term: parts[0].trim(), def: parts.slice(1).join(' ').trim() };
  });
}

function extractExamples(text) {
  const patterns = [/for example[,:]?([^.]+\.)/gi, /such as([^.]+\.)/gi, /e\.g\.([^.]+\.)/gi, /instance[,:]([^.]+\.)/gi];
  const results = [];
  patterns.forEach(p => {
    let m;
    while ((m = p.exec(text)) !== null && results.length < 5) {
      const ex = m[1].trim();
      if (ex.length > 20) results.push(ex.charAt(0).toUpperCase() + ex.slice(1));
    }
  });
  return results.length >= 3 ? results.slice(0, 5) : null;
}

function buildFlashcards(text) {
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).filter(s => s.trim().length > 40);
  if (sentences.length < 5) return null;
  // Pick 5 well-spaced sentences and turn them into Q&A
  const step = Math.floor(sentences.length / 5);
  const pairs = [];
  for (let i = 0; i < 5; i++) {
    const s = sentences[i * step].trim();
    // Turn sentence into a question by removing the last word group
    const words = s.split(' ');
    if (words.length < 6) continue;
    const answer = words.slice(-Math.floor(words.length * 0.4)).join(' ').replace(/[.!?]$/, '');
    const question = 'Complete the statement: "' + words.slice(0, Math.ceil(words.length * 0.6)).join(' ') + '…"';
    pairs.push({ q: question, a: answer });
  }
  return pairs.length >= 3 ? pairs : null;
}

function buildQuiz(text) {
  // Build multiple-choice questions from text sentences
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).filter(s => s.trim().length > 50);
  if (sentences.length < 5) return null;

  const step = Math.floor(sentences.length / 5);
  const questions = [];

  for (let i = 0; i < 5; i++) {
    const s = sentences[i * step].trim();
    const words = s.split(' ');
    if (words.length < 8) continue;

    // Blank out a keyword
    const targetIdx = Math.floor(words.length * 0.6);
    const answer = words[targetIdx].replace(/[^a-zA-Z]/g, '');
    if (answer.length < 3) continue;

    const stem = words.map((w, idx) => idx === targetIdx ? '______' : w).join(' ');
    const distractors = generateDistractors(answer, text);

    const options = shuffle([answer, ...distractors.slice(0, 3)]);
    const correct = ['A','B','C','D'][options.indexOf(answer)];

    questions.push({
      q: `Fill in the blank: "${stem}"`,
      options,
      correct,
      explanation: `The correct answer is "${answer}". It fits the context of the original statement.`
    });
  }

  return questions.length >= 3 ? questions : null;
}

function generateDistractors(word, text) {
  const words = [...new Set(
    text.match(/\b[a-zA-Z]{4,12}\b/g) || []
  )].filter(w => w.toLowerCase() !== word.toLowerCase() && w.length > 3);
  return shuffle(words).slice(0, 3);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildFallbackQuiz() {
  return [
    {
      q: 'Which of the following best describes the purpose of creating a structured study plan?',
      options: ['To memorise content word for word', 'To organise and prioritise learning efficiently', 'To avoid reading the material in full', 'To replace attending lectures'],
      correct: 'B',
      explanation: 'A structured study plan helps you organise and prioritise your learning efficiently, making revision sessions more productive.'
    },
    {
      q: 'What is the benefit of using bullet-point summaries when reviewing notes?',
      options: ['They make notes longer and harder to review', 'They replace the need for reading', 'They condense information for quicker recall', 'They only work for science subjects'],
      correct: 'C',
      explanation: 'Bullet-point summaries condense key information, making it easier to recall during revision without reading everything again.'
    },
    {
      q: 'Flashcards are primarily used to:',
      options: ['Write long essays', 'Test active recall of key terms and concepts', 'Replace textbooks entirely', 'Practice drawing diagrams'],
      correct: 'B',
      explanation: 'Flashcards are a proven active-recall tool that strengthen memory by testing your knowledge repeatedly.'
    },
    {
      q: 'What does "active recall" mean in the context of studying?',
      options: ['Re-reading your notes multiple times', 'Highlighting text in different colours', 'Retrieving information from memory without looking at notes', 'Listening to recorded lectures'],
      correct: 'C',
      explanation: 'Active recall means testing yourself by retrieving information from memory, which is far more effective than passive re-reading.'
    },
    {
      q: 'Which study strategy is most likely to improve long-term retention?',
      options: ['Cramming all material the night before', 'Spaced repetition over several sessions', 'Reading notes once thoroughly', 'Writing everything from memory immediately after one reading'],
      correct: 'B',
      explanation: 'Spaced repetition – revisiting material at increasing intervals – is one of the most research-backed strategies for long-term memory retention.'
    }
  ];
}

// ─── Render Results ───────────────────────────
function renderResults(data) {
  // Meta
  studyTimeEl.textContent   = data.studyTime;
  difficultyEl.textContent  = data.difficulty;

  // Summary
  summaryList.innerHTML = data.summary
    .map(s => `<li>${s}</li>`).join('');

  // Glossary
  glossaryList.innerHTML = data.glossary
    .map(g => `<dt>${g.term}</dt><dd>${g.def}</dd>`).join('');

  // Examples
  examplesList.innerHTML = data.examples
    .map(ex => `<li>${ex}</li>`).join('');

  // Flashcards
  flashcards = data.flashcards;
  currentCard = 0;
  renderFlashcard();

  // Quiz
  quizQuestions = data.quiz;
  quizIndex     = 0;
  quizScore     = 0;
  quizActive    = false;
  awaitingAnswer = false;
  quizInput.disabled  = false;
  quizSend.disabled   = false;
  scorePanel.hidden   = true;
  clearChat();
  addMessage('assistant',
    '👋 <strong>Welcome to the Quiz!</strong> I\'ll test your understanding of the uploaded notes.<br/><br/>' +
    'When you\'re ready, type <strong>start</strong> and I\'ll present the first question. Answer with <strong>A, B, C, or D</strong>.<br/><br/>' +
    'Good luck! 🍀'
  );
}

// ─── Flashcard Logic ─────────────────────────
function renderFlashcard() {
  carousel.innerHTML = '';
  const card = flashcards[currentCard];
  const wrapper = document.createElement('div');
  wrapper.className = 'flashcard-wrapper';
  wrapper.innerHTML = `
    <div class="flashcard-front">
      <span class="flashcard-label">Question</span>
      ${card.q}
    </div>
    <div class="flashcard-back">
      <span class="flashcard-label">Answer</span>
      ${card.a}
    </div>`;
  wrapper.addEventListener('click', () => wrapper.classList.toggle('flipped'));
  carousel.appendChild(wrapper);
  cardCounter.textContent = `${currentCard + 1} / ${flashcards.length}`;
  prevBtn.disabled = currentCard === 0;
  nextBtn.disabled = currentCard === flashcards.length - 1;
}

prevBtn.addEventListener('click', () => { if (currentCard > 0) { currentCard--; renderFlashcard(); } });
nextBtn.addEventListener('click', () => { if (currentCard < flashcards.length - 1) { currentCard++; renderFlashcard(); } });

// ─── Quiz Logic ───────────────────────────────
quizSend.addEventListener('click', handleQuizInput);
quizInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleQuizInput(); });

function handleQuizInput() {
  const val = quizInput.value.trim();
  if (!val) return;
  addMessage('user', val);
  quizInput.value = '';

  if (!quizActive && val.toLowerCase() === 'start') {
    quizActive    = true;
    quizIndex     = 0;
    quizScore     = 0;
    awaitingAnswer = false;
    setTimeout(() => presentQuestion(), 400);
    return;
  }

  if (quizActive && awaitingAnswer) {
    const letter = val.toUpperCase().trim();
    if (!['A','B','C','D'].includes(letter)) {
      addMessage('assistant', '⚠️ Please answer with <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, or <strong>D</strong>.');
      return;
    }
    evaluateAnswer(letter);
    return;
  }

  if (!quizActive) {
    addMessage('assistant', 'Type <strong>start</strong> to begin the quiz! 🎯');
  }
}

function presentQuestion() {
  if (quizIndex >= quizQuestions.length) {
    finishQuiz();
    return;
  }
  const q = quizQuestions[quizIndex];
  const opts = ['A','B','C','D'].map((l, i) => `<strong>${l})</strong> ${q.options[i]}`).join('<br/>');
  addMessage('assistant',
    `<strong>Question ${quizIndex + 1} of ${quizQuestions.length}</strong><br/><br/>` +
    `${q.q}<br/><br/>${opts}`
  );
  awaitingAnswer = true;
}

function evaluateAnswer(letter) {
  awaitingAnswer = false;
  const q = quizQuestions[quizIndex];
  const isCorrect = letter === q.correct;
  if (isCorrect) {
    quizScore++;
    addMessage('correct',
      `✅ <strong>Correct!</strong><br/>${q.explanation}`
    );
  } else {
    addMessage('wrong',
      `❌ <strong>Not quite.</strong> The correct answer was <strong>${q.correct}</strong>.<br/>${q.explanation}`
    );
  }
  quizIndex++;
  setTimeout(() => presentQuestion(), 600);
}

function finishQuiz() {
  quizActive = false;
  const pct = (quizScore / quizQuestions.length) * 100;
  const emoji = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '📖' : '💪';
  addMessage('assistant',
    `${emoji} <strong>Quiz Complete!</strong> You scored <strong>${quizScore}/${quizQuestions.length}</strong>.<br/>` +
    (pct === 100 ? 'Perfect score! Outstanding work.' : pct >= 80 ? 'Great job! You clearly know this material well.' : pct >= 60 ? 'Good effort! A bit more review will get you there.' : 'Keep going — revisit the notes and try again.')
  );

  setTimeout(() => {
    scorePanel.hidden = false;
    scoreNum.textContent = quizScore;
    scoreLabel.textContent = pct >= 80 ? '🎉 Excellent work!' : pct >= 60 ? '👍 Good effort!' : '📖 Keep practising!';
    scorePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 500);

  quizInput.disabled = true;
  quizSend.disabled  = true;
}

// ─── Confidence Rating ───────────────────────
confidenceStars.forEach(btn => {
  btn.addEventListener('click', () => {
    confidenceStars.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const val = parseInt(btn.dataset.val);
    showStudyTips(val);
  });
});

function showStudyTips(rating) {
  const existing = document.querySelector('.study-tips');
  if (existing) existing.remove();

  const tips = getStudyTips(rating);
  const div = document.createElement('div');
  div.className = 'study-tips';
  div.innerHTML = `<h3>📚 Personalised Study Tips for You</h3><p>${tips}</p>`;
  scorePanel.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getStudyTips(rating) {
  const tipsMap = {
    1: `You're still building confidence — that's completely normal! Start by re-reading your notes slowly and highlighting key terms. Try the flashcards one more time, paying special attention to the ones that surprised you. Break the material into smaller chunks and tackle one section per study session. Consider creating a simple mind map to visualise how the concepts connect.`,
    2: `You have a foundation — now it's time to strengthen it. Revisit the bullet-point summary and try to explain each point in your own words without looking. Redo the flashcards and aim to answer before flipping. Schedule two more focused sessions spaced a day apart to reinforce memory through spaced repetition.`,
    3: `Solid middle ground! You understand the basics but there are gaps to fill. Focus your next session on the questions you got wrong in the quiz. Try teaching the concepts to someone else (or even to a wall!) — explaining something out loud reveals hidden gaps. Re-read the glossary and make sure every term is crystal clear.`,
    4: `You're in great shape! To push to mastery, try writing a short essay or summary without any notes. Attempt the quiz again and challenge yourself to explain why each wrong option is incorrect — this deepens understanding beyond surface recall. Explore a real-world application of the material to cement your knowledge.`,
    5: `Excellent confidence! To stay at the top, teach this material to a peer — teaching is the ultimate test of knowledge. Look for advanced resources or related topics to broaden your understanding. Revisit this material briefly in a week (spaced repetition) to lock it in for the long term. You're quiz-ready! 🏆`
  };
  return tipsMap[rating];
}

// ─── Chat Helpers ─────────────────────────────
function addMessage(type, html) {
  const div = document.createElement('div');
  div.className = `chat-message ${type === 'user' ? 'user-msg' : type === 'correct' ? 'assistant-msg correct-msg' : type === 'wrong' ? 'assistant-msg wrong-msg' : 'assistant-msg'}`;
  div.innerHTML = html;
  quizChat.appendChild(div);
  quizChat.scrollTop = quizChat.scrollHeight;
}

function clearChat() {
  quizChat.innerHTML = '';
}

// ─── Utilities ────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }


/* =============================================
   AI Chatbot – Amazon Bedrock (Bearer Token)
   Model: us.anthropic.claude-haiku-4-5-20251001-v1:0
   Region: ap-southeast-5
   ============================================= */

(function () {

  // ── Config ────────────────────────────────
  const BEARER_TOKEN = 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFTSUE0Uk9KRzVFQ0czUjRVSkQ2JTJGMjAyNjEwMDIlMkZhcC1zb3V0aGVhc3QtNSUyRmJlZHJvY2slMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MTAwMlQxMjAzNTdaJlgtQW16LUV4cGlyZXM9NDMyMDAmWC1BbXotU2VjdXJpdHktVG9rZW49SVFvSmIzSnBaMmx1WDJWakVFY2FEbUZ3TFhOdmRYUm9aV0Z6ZEMwMUlrY3dSUUlnT1VjcXVQT25NUE54JTJGNEhXcldDUmg3c296aXhEJTJGeSUyQmk4N0VRMHZmWmlvTUNJUUQyZUxtRUpZYm1sSVJrODFseFMlMkZTd1M0VzlXTHYxQnFmV3FOdzkzdmxyMmlxaEJRaVYlMkYlMkYlMkYlMkYlMkYlMkYlMkYlMkYlMkYlMkY4QkVBQWFERGcyTWpBNU9UYzVOREU0TUNJTWI2THdad3AwOWNyeVRzRkJLdlVFVXhiOFRxazB4VCUyQjZKRG9YQ3gwUEx5NTMzYXp0WE1UekQ2WllNRWhpUllOaVJWUDAzWG1CS21EN1lxckk0Q0RCMDdHamc5QWZiQ1pPcHF5cVM2SkJ0MHY3MkJQbDRLNWJmUlBSUVV2NnlyQlh2YjNxJTJCYjlyZ0hqd0FQc1BwTUI4eG5ZY044M1VNajk5WHI5N09KJTJGbHBzZGR3MnhxSGROMUVrODhkWCUyRldMQTJUZFhUaXlLcmx4QSUyRlE2ZDZTRVJ4cGRLUVNGWFBMJTJCaXFRM2EzM3k0VXRCSGxJS09FSWRxJTJGZmx5SndBVjFGT2h5aUdBaVJIR2QlMkZMT0VHSkhlaU1jU1hWclBkV0taMUZ3aHhUdFFlU0psejFqeTUwNW9lZkNzdTN0NmdWVm51YXlGN1BGRmpLTTNLcjFvJTJGQ3RQYzlsRXhRYU1UT1BzZmw3OEdObVdhT0I5Rjkzc1VIYW1OVG1HRHZJdWJweTE2N29FT3NnTyUyRjQlMkY5RVdzQmNDUHBkbzBlRE5RQjhBNkFoaE5qJTJGS0ZsZW0wMWUlMkJLVGE4eFVjT3FhJTJGdVd3bUlOTEdaNlNIa1d6TGRxQ01ycVVkVGI4TElBdFNxJTJGNEtSdWJMandIU1g5Y00lMkZqVWJ5QmI2SmdrdWJjJTJGdVQzMWlqOEtjN2FtTjFKb25zR05WZ2NCSDR4TmczYk9RWlN5M2pzbFJNcTN5ZE5vWHFVOGxJNDclMkJ1aWNJUyUyQkR1Z0Y0ekpqU0ZIJTJGOVV6ZVl5V21sVjJIem0lMkJlMlUyUWxBVjE4ZHNzU0llb3N3NVB5NXhMMHZsWSUyQkw5TGxQcUhpeDBqejVvdTZzdERFenpSdkFFd3dLVVRSM0dWbWxyQVQ2JTJGYzdTYVhzclo4bkx1R0VoMDN3UVpvRU82VWt6alkzeTl0ZzdXdVp5SVFzQ3NpZ3p1OVJwWjJSaFE3RVRKMnh1dW93dEtqODNmVTh6dExBZno1Z3RTNjBSZCUyRmJRZGdGaUdDUnk3OVl4eTZwTUg0Wm15akRGVlolMkJRWUF4ZWdUNWRkakdrcW4lMkZNdUlHdExnaElxd3ZNQmIlMkZ2ZnMlMkJQQkJtOHZOZkh4Zk11UHZzU0Vna0lDTlhRNkl2WHVQa0M1MTd2WEtRRU8lMkZVd3o3TCUyQjFRWTZ4d0t4SFRjJTJGZ0NjJTJGVk9HVEVlZHcxajA5byUyQlAzViUyQjJJSndGcmVYd0pnOTFYaVAzMXNqJTJGQVlHOFQxZEUwNW1xT2hMazB0cFR5bFdnS0NwS0U0M1NxYW9PVmE5THpuSlFldzEzMmFMJTJGRkpJamxNSyUyQmtmakwlMkZTUHZGMUhoMVBlZiUyRkdocm5HVDBBQVJ2TGVGUWxuUGhsZUdwcVNqSHVvTjhIMEEzJTJCbUVqY2R1TTVNc3FENk5KcTJYakFRMHlzN21VSEVjSE1LdmFvNmMxVUdEJTJGOTJIYzViRlVXU29tMGpwdHRxT005Tk5yOUtISVZqRXB2WTIlMkJ0Y2xEMEZZSFZOdjducVo0JTJCNVU4UU5jZVNFbHg2N0g0MHI0TU85OUUzdHdqamwzbHdKbmF0YkVKNmFvNkJ4YW9zanJGWjNBU20zVnlwcTdia3ZUWG9GJTJGVnhhczlNQkNtenhTbmR4dzF3JTJGVXVLVXBERjBGOHR3dE9YY0oxU0RHdTV5MXRVQ1ZCejBwQkVOa1RpZmxPQ3E4ZVN0JTJGSFRSUlBYR2UzaVQ2T3RhM0gxUWh1RVNqaGElMkZnOW9wRTg0YU5Wc1o0SSUzRCZYLUFtei1TaWduYXR1cmU9NGJmNTIyZjFjNDY3YmNmNjhjOGZhZDhiNTJmMTg0MjI3Y2JlZDRiNTBkNDJhNmUzYTg3NzMyZGE5NmIwNzc5YiZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmVmVyc2lvbj0x';

  // AWS Bedrock endpoint — Claude Haiku 4.5 on ap-southeast-5
  // Model matches: us.anthropic.claude-haiku-4-5-20251001-v1:0
  // ap-southeast-5 (Malaysia) has no Geo profile — use the Global inference profile.
  // See: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html
  const MODEL_ID        = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
  const BEDROCK_ENDPOINT =
    `https://bedrock-runtime.ap-southeast-5.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/invoke`;

  // ── DOM refs ──────────────────────────────
  const toggle       = document.getElementById('chatbotToggle');
  const panel        = document.getElementById('chatbotPanel');
  const openIcon     = document.getElementById('chatbotOpenIcon');
  const closeIcon    = document.getElementById('chatbotCloseIcon');
  const messagesEl   = document.getElementById('chatbotMessages');
  const inputEl      = document.getElementById('chatbotInput');
  const sendBtn      = document.getElementById('chatbotSend');
  const clearBtn     = document.getElementById('chatbotClear');

  // ── Conversation history ──────────────────
  // Keeps the last N turns for multi-turn context
  const MAX_HISTORY = 10;
  let history = []; // [{ role: 'user'|'assistant', content: '...' }, …]

  // ── Toggle open/close ─────────────────────
  toggle.addEventListener('click', () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    openIcon.hidden  = !isOpen;
    closeIcon.hidden = isOpen;
    if (!isOpen) {
      inputEl.focus();
    }
  });

  // ── Clear chat ────────────────────────────
  clearBtn.addEventListener('click', () => {
    history = [];
    messagesEl.innerHTML = '';
    appendBubble('ai',
      '🗑️ Chat cleared. Ask me anything about your study notes or any topic!');
  });

  // ── Send on Enter or button click ─────────
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ── Core send function ────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    setInputEnabled(false);

    // Show user bubble
    appendBubble('user', text);

    // Add to history
    history.push({ role: 'user', content: text });
    if (history.length > MAX_HISTORY * 2) history = history.slice(-MAX_HISTORY * 2);

    // Show typing indicator
    const typingId = appendTyping();

    try {
      const reply = await callBedrock(history);
      removeTyping(typingId);
      appendBubble('ai', reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      removeTyping(typingId);
      appendBubble('ai', `⚠️ Sorry, something went wrong: ${err.message}`);
      console.error('[Chatbot] Bedrock error:', err);
    }

    setInputEnabled(true);
    inputEl.focus();
  }

  // ── Bedrock API call ──────────────────────
  // Mirrors exactly what BedrockRuntimeClient / InvokeModelCommand sends:
  //   body = JSON.stringify({ anthropic_version, max_tokens, messages })
  // We POST the same payload over fetch with a Bearer token header.
  async function callBedrock(conversationHistory) {
    const systemPrompt =
      'You are an expert AI Study Tutor built into StudySnap, an app that helps students ' +
      'understand lecture notes. Answer clearly and concisely. When explaining concepts, ' +
      'use simple language and examples. Keep responses under 200 words unless a detailed ' +
      'explanation is specifically requested.';

    // Exact body shape used by InvokeModelCommand
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationHistory.map(m => ({
        role: m.role,
        content: m.content
      }))
    };

    const response = await fetch(BEDROCK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    // Mirrors: JSON.parse(new TextDecoder().decode(response.body))
    const data = await response.json();

    // Claude response shape: { content: [{ type: 'text', text: '...' }] }
    const textBlock = data?.content?.find(c => c.type === 'text');
    if (!textBlock) throw new Error('No text in Bedrock response.');
    return textBlock.text;
  }

  // ── UI helpers ────────────────────────────
  function appendBubble(role, text) {
    const row = document.createElement('div');
    row.className = `cb-msg cb-msg-${role === 'user' ? 'user' : 'ai'}`;

    const bubble = document.createElement('span');
    bubble.className = 'cb-bubble';
    bubble.textContent = text; // textContent keeps XSS-safe

    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function appendTyping() {
    const id = 'cb-typing-' + Date.now();
    const row = document.createElement('div');
    row.className = 'cb-msg cb-msg-ai cb-typing';
    row.id = id;
    row.innerHTML = `<span class="cb-bubble"><span></span><span></span><span></span></span>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function setInputEnabled(enabled) {
    inputEl.disabled = !enabled;
    sendBtn.disabled = !enabled;
  }

})();
