(() => {
  const style = document.createElement("style");
  style.textContent = `
    .coach-edit { margin-top: 10px; }
    .coach-edit textarea { min-height: 92px; margin-top: 8px; background: #fff; }
    .save-improvement { margin-top: 10px; background: var(--warning); }
    .save-improvement:hover { background: #87331f; }
  `;
  document.head.appendChild(style);

  evaluate = function evaluate(answer) {
    const questionCount = (answer.match(/\?/g) || []).length;
    const words = answer.split(/\s+/).filter(Boolean).length;
    const lower = answer.toLowerCase();
    const pushWords = ["moet", "zeker", "gewoon", "vandaag beslissen", "beste deal", "geloof mij", "geen probleem"];
    const calmWords = ["begrijp", "helder", "logisch", "rustig", "mag ik", "wat maakt", "hoe kijkt"];
    const hasOpenQuestion = /\b(wat|waarom|hoe|welke|wanneer|wie)\b/i.test(answer) && questionCount > 0;
    const hasReflect = /\b(begrijp|hoor|klinkt|bedoelt|als ik u goed begrijp|helder)\b/i.test(answer);
    const pushCount = pushWords.filter((word) => lower.includes(word)).length;
    const calmCount = calmWords.filter((word) => lower.includes(word)).length;
    const feedbackKey = getFeedbackKey(answer);

    return {
      controle: clamp(4 + (hasReflect ? 1 : 0) + (hasOpenQuestion ? 2 : 0) - pushCount - (words > 55 ? 1 : 0)),
      vraagstelling: clamp(3 + questionCount * 2 + (hasOpenQuestion ? 2 : 0) - (questionCount > 2 ? 1 : 0)),
      rust: clamp(5 + calmCount - pushCount - (words > 45 ? 1 : 0) - (words > 75 ? 2 : 0)),
      feedback: buildFeedback({ answer, questionCount, hasOpenQuestion, hasReflect, pushCount, words }),
      improved: getSavedImprovedAnswer(feedbackKey) || buildExpertAnswer(answer),
      feedbackKey
    };
  };

  addCoachMessage = function addCoachMessage(evaluation) {
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
      <label class="coach-edit">
        <strong>Juiste antwoord a la Andres/Jeremy</strong>
        <textarea data-feedback-key="${escapeHtml(evaluation.feedbackKey)}">${escapeHtml(evaluation.improved)}</textarea>
      </label>
      <button type="button" class="save-improvement">Bewaar als mijn verbetering</button>
    `;
    wrapper.querySelector(".save-improvement").addEventListener("click", () => {
      const textarea = wrapper.querySelector("[data-feedback-key]");
      saveImprovedAnswer(textarea.dataset.feedbackKey, clean(textarea.value));
      wrapper.querySelector(".save-improvement").textContent = "Bewaard";
    });
    conversation.appendChild(wrapper);
    scrollToBottom();
  };

  function buildExpertAnswer(answer) {
    const topic = inferTopic(answer);
    const customer = state.scenario?.customer || "u";

    if (topic === "prijs") {
      return "Helemaal helder, prijs moet logisch voelen voordat u verder kijkt. Mag ik vragen waarmee u de prijs vergelijkt en wat er voor u naast het bedrag mee moet kloppen?";
    }
    if (topic === "afstemming") {
      return "Logisch dat u dit wilt afstemmen. Wat zou uw partner of team vooral moeten begrijpen om hier rustig ja of nee op te kunnen zeggen?";
    }
    if (topic === "timing") {
      return "Begrijpelijk dat u geen gehaaste beslissing wilt nemen. Wat zou er vandaag duidelijk moeten worden zodat nadenken ook echt richting geeft?";
    }
    if (topic === "vergelijking") {
      return "Snap ik, vergelijken is verstandig. Op welke punten beslist u straks tussen ons en die andere optie, behalve alleen prijs?";
    }
    return `Helder, als ${customer} wilt u eerst zekerheid voordat u verdergaat. Wat is de grootste twijfel die we eerst rustig moeten uitklaren?`;
  }

  function getFeedbackKey(answer) {
    const topic = inferTopic(answer);
    const objection = normalizeKey(state.lastObjection || topic);
    return `${topic}:${objection}`;
  }

  function getSavedImprovedAnswer(key) {
    return getSavedAnswers()[key] || "";
  }

  function saveImprovedAnswer(key, answer) {
    if (!key || !answer) return;
    const saved = getSavedAnswers();
    saved[key] = answer;
    localStorage.setItem("salestrainerImprovedAnswers", JSON.stringify(saved));
  }

  function getSavedAnswers() {
    try {
      return JSON.parse(localStorage.getItem("salestrainerImprovedAnswers") || "{}");
    } catch {
      return {};
    }
  }

  function normalizeKey(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9À-ÿ]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }
})();
