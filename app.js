const setupPanel = document.querySelector("#setupPanel");
const trainerPanel = document.querySelector("#trainerPanel");
const setupForm = document.querySelector("#setupForm");
const replyForm = document.querySelector("#replyForm");
const replyInput = document.querySelector("#replyInput");
const conversation = document.querySelector("#conversation");
const scenarioMeta = document.querySelector("#scenarioMeta");
const pressureButton = document.querySelector("#pressureButton");
const resetButton = document.querySelector("#resetButton");

const defaultObjections = [
  "Ik vind het te duur.",
  "Ik wil er nog eens over nadenken.",
  "Ik moet dit eerst met mijn partner bespreken.",
  "Ik heb bij een concurrent iets goedkopers gezien.",
  "Ik zie de meerwaarde nog niet genoeg."
];

const interruptionStarts = [
  "Wacht even.",
  "Maar eerlijk?",
  "Ja, maar luister.",
  "Ik ga u onderbreken.",
  "Dat klinkt mooi, maar"
];

const extraObjections = [
  "ik vertrouw die berekening nog niet.",
  "ik wil geen druk voelen vandaag.",
  "ik heb slechte ervaringen met verkopers.",
  "ik weet niet of dit nu prioriteit heeft.",
  "ik wil eerst drie offertes vergelijken."
];

let state = {
  scenario: null,
  pressure: false,
  turn: 0,
  lastObjection: ""
};

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(setupForm);
  const objections = splitObjections(data.get("objections"));

  state.scenario = {
    sector: clean(data.get("sector")),
    customer: clean(data.get("customer")),
    level: data.get("level"),
    objections: objections.length ? objections : defaultObjections
  };

  startScenario();
});

replyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const answer = clean(replyInput.value);
  if (!answer) return;

  addMessage("seller", "Jij", answer);
  replyInput.value = "";
  handleSellerAnswer(answer);
});

pressureButton.addEventListener("click", () => {
  state.pressure = !state.pressure;
  pressureButton.classList.toggle("active", state.pressure);
  pressureButton.textContent = state.pressure ? "Pressure mode aan" : "Pressure mode";
  addMessage(
    "customer",
    "Klant",
    state.pressure
      ? "Oké, dan zeg ik het direct: ik heb weinig tijd, ik wil geen verkoopspraat, en het moet financieel kloppen."
      : "Goed, dan wil ik vooral rustig begrijpen waarom dit voor mij zinvol zou zijn."
  );
});

resetButton.addEventListener("click", () => {
  setupPanel.hidden = false;
  trainerPanel.hidden = true;
  conversation.innerHTML = "";
  state.turn = 0;
  state.pressure = false;
  pressureButton.classList.remove("active");
  pressureButton.textContent = "Pressure mode";
});

function startScenario() {
  state.turn = 0;
  state.pressure = false;
  conversation.innerHTML = "";
  pressureButton.classList.remove("active");
  pressureButton.textContent = "Pressure mode";
  setupPanel.hidden = true;
  trainerPanel.hidden = false;
  scenarioMeta.textContent = `${state.scenario.sector} · ${state.scenario.customer} · ${state.scenario.level}`;

  const objection = pick(state.scenario.objections);
  state.lastObjection = objection;
  addMessage(
    "customer",
    "Klant",
    `Ik snap wat u zegt, maar ${lowerFirst(objection)}`
  );
  replyInput.focus();
}

function handleSellerAnswer(answer) {
  state.turn += 1;
  const evaluation = evaluate(answer);
  addCoachMessage(evaluation);
  addMessage("customer", "Klant", nextCustomerLine(answer, evaluation));
}

function evaluate(answer) {
  const questionCount = (answer.match(/\?/g) || []).length;
  const words = answer.split(/\s+/).filter(Boolean).length;
  const lower = answer.toLowerCase();
  const pushWords = ["moet", "zeker", "gewoon", "vandaag beslissen", "beste deal", "geloof mij", "geen probleem"];
  const calmWords = ["begrijp", "helder", "logisch", "rustig", "mag ik", "wat maakt", "hoe kijkt"];
  const hasOpenQuestion = /\b(wat|waarom|hoe|welke|wanneer|wie)\b/i.test(answer) && questionCount > 0;
  const hasReflect = /\b(begrijp|hoor|klinkt|bedoelt|als ik u goed begrijp|helder)\b/i.test(answer);
  const pushCount = pushWords.filter((word) => lower.includes(word)).length;
  const calmCount = calmWords.filter((word) => lower.includes(word)).length;

  const controle = clamp(4 + (hasReflect ? 1 : 0) + (hasOpenQuestion ? 2 : 0) - pushCount - (words > 55 ? 1 : 0));
  const vraagstelling = clamp(3 + questionCount * 2 + (hasOpenQuestion ? 2 : 0) - (questionCount > 2 ? 1 : 0));
  const rust = clamp(5 + calmCount - pushCount - (words > 45 ? 1 : 0) - (words > 75 ? 2 : 0));

  return {
    controle,
    vraagstelling,
    rust,
    feedback: buildFeedback({ answer, questionCount, hasOpenQuestion, hasReflect, pushCount, words }),
    improved: buildImprovedAnswer(answer)
  };
}

function buildFeedback(details) {
  const feedback = [];

  if (!details.hasReflect) {
    feedback.push("Je neemt de objectie te weinig eerst terug in jouw woorden.");
  }
  if (!details.hasOpenQuestion) {
    feedback.push("Je vraag is te gesloten of ontbreekt, waardoor jij moet gaan overtuigen.");
  }
  if (details.pushCount > 0) {
    feedback.push("Je pusht door zekerheid te claimen in plaats van de klant te laten nadenken.");
  }
  if (details.words > 55) {
    feedback.push("Je praat te lang; daardoor geef je controle weg.");
  }
  if (!feedback.length) {
    feedback.push("Je houdt controle, maar maak je vervolgvraag scherper en concreter.");
  }

  return feedback.slice(0, 3);
}

function buildImprovedAnswer(answer) {
  const topic = inferTopic(answer);
  return `Helder, ${topic} is dus het punt waar u eerst zekerheid over wilt. Wat moet er voor u concreet duidelijk zijn om dit rustig te kunnen beoordelen?`;
}

function nextCustomerLine(answer, evaluation) {
  const pressure = state.pressure;
  const weakScore = evaluation.controle + evaluation.vraagstelling + evaluation.rust < 18;
  const base = pick(state.scenario.objections);
  const interrupt = pick(interruptionStarts);
  const extra = pick(extraObjections);

  if (pressure) {
    state.lastObjection = `${base} En ${extra}`;
    return `${interrupt} ${lowerFirst(base)} En bovendien: ${extra} Waarom zou ik hier nu tijd in steken?`;
  }

  if (weakScore) {
    state.lastObjection = base;
    return `${interrupt} ik voel nog vooral dat u mij wilt overtuigen. ${base}`;
  }

  if (state.turn % 3 === 0) {
    state.lastObjection = extra;
    return `Dat is een betere vraag. Maar ${extra}`;
  }

  state.lastObjection = base;
  return `Misschien. Maar ${lowerFirst(base)} Wat maakt dit volgens u dan anders voor iemand zoals ik?`;
}

function addCoachMessage(evaluation) {
  const wrapper = document.createElement("article");
  wrapper.className = "message coach";
  wrapper.innerHTML = `
    <strong>Trainer</strong>
    <div class="score-grid">
      <div class="score"><span>Controle</span>${evaluation.controle}/10</div>
      <div class="score"><span>Vraagstelling</span>${evaluation.vraagstelling}/10</div>
      <div class="score"><span>Rust/tempo</span>${evaluation.rust}/10</div>
    </div>
    <p><strong>Harde feedback</strong>${evaluation.feedback.map(escapeHtml).join("<br>")}</p>
    <p><strong>Verbeterde versie</strong>${escapeHtml(evaluation.improved)}</p>
  `;
  conversation.appendChild(wrapper);
  scrollToBottom();
}

function addMessage(type, name, text) {
  const message = document.createElement("article");
  message.className = `message ${type}`;
  message.innerHTML = `<strong>${escapeHtml(name)}</strong>${escapeHtml(text)}`;
  conversation.appendChild(message);
  scrollToBottom();
}

function splitObjections(value) {
  return clean(value)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clean(value) {
  return String(value || "").trim();
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value) {
  return Math.max(1, Math.min(10, value));
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function inferTopic(answer) {
  const lower = answer.toLowerCase();
  if (lower.includes("prijs") || lower.includes("duur") || lower.includes("budget")) return "prijs";
  if (lower.includes("partner") || lower.includes("team") || lower.includes("collega")) return "afstemming";
  if (lower.includes("tijd") || lower.includes("nadenken")) return "timing";
  if (lower.includes("concurrent") || lower.includes("offerte")) return "vergelijking";
  return "twijfel";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scrollToBottom() {
  conversation.scrollTop = conversation.scrollHeight;
}
