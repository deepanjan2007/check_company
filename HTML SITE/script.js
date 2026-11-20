const $ = (id) => document.getElementById(id);
const STORAGE = "inkloom-ai-demo-v1";

let historyItems = [];
let currentReport = null;

let guidelines = {
  brandName: "InKloom AI",
  tone: "Professional",
  color: "#635bff",
  approvedTerms: ["customer", "reliable", "trusted", "solution"],
  blockedClaims: [
    "best company",
    "number one",
    "no. 1",
    "guaranteed",
    "100% guaranteed"
  ]
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");

    if (saved.guidelines) guidelines = saved.guidelines;
    if (Array.isArray(saved.history)) historyItems = saved.history;

  } catch (e) {
    console.warn("Could not load local demo data", e);
  }

  fillGuidelines();
  renderStats();
  renderHistory();
}

function saveData() {
  localStorage.setItem(
    STORAGE,
    JSON.stringify({ guidelines, history: historyItems })
  );
}

function fillGuidelines() {
  $("brand-name").value = guidelines.brandName;
  $("brand-tone").value = guidelines.tone;
  $("brand-color").value = guidelines.color;

  $("color-code").textContent = guidelines.color.toUpperCase();

  $("approved-terms").value =
    (guidelines.approvedTerms || []).join(", ");

  $("blocked-claims").value =
    (guidelines.blockedClaims || []).join(", ");
}

function toast(message) {
  const t = $("toast");

  t.textContent = message;
  t.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(
    () => t.classList.remove("show"),
    2300
  );
}

function navigate(view) {
  document.querySelectorAll(".view").forEach(el => {
    el.classList.remove("active");
  });

  $(view + "-view").classList.add("active");

  document.querySelectorAll(".nav-link").forEach(el => {
    el.classList.toggle(
      "active",
      el.dataset.view === view
    );
  });

  const titles = {
    dashboard: "Dashboard",
    checker: "Content Checker",
    guidelines: "Brand Guidelines",
    history: "Review History"
  };

  $("page-title").textContent = titles[view] || "Dashboard";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.querySelectorAll("[data-view]").forEach(btn => {
  btn.addEventListener("click", () => navigate(btn.dataset.view));
});

document.querySelectorAll("[data-go]").forEach(btn => {
  btn.addEventListener("click", () => navigate(btn.dataset.go));
});

$("content-text").addEventListener("input", () => {
  $("char-count").textContent =
    $("content-text").value.length + " characters";
});

$("content-text").dispatchEvent(new Event("input"));

$("file-input").addEventListener("change", async e => {
  const file = e.target.files[0];

  if (!file) return;

  $("content-text").value = await file.text();

  $("content-title").value =
    file.name.replace(/\.txt$/i, "");

  $("content-text").dispatchEvent(new Event("input"));

  toast("Text file imported");
});

function analyzeContent(text) {
  const lower = text.toLowerCase();

  let issues = [];
  let revised = text;
  let score = 100;

  const blocked = (guidelines.blockedClaims || []).filter(Boolean);

  blocked.forEach(phrase => {
    const p = phrase.toLowerCase();

    if (lower.includes(p)) {
      issues.push({
        type: "Unsupported or restricted claim",
        severity: "High",
        detail: `The phrase “${phrase}” may be an unverified or restricted claim.`,
        suggestion: "Use a specific, evidence-backed statement instead."
      });

      const safeReplacement =
        guidelines.brandName + " provides reliable services.";

      const regex = new RegExp(escapeRegExp(phrase), "gi");

      revised = revised.replace(regex, safeReplacement);

      score -= 22;
    }
  });

  const casual = [
    "hey folks",
    "hey guys",
    "gonna",
    "awesome",
    "wanna",
    "yo "
  ];

  casual.forEach(phrase => {
    if (lower.includes(phrase)) {
      issues.push({
        type: "Tone inconsistency",
        severity: "Medium",
        detail: `“${phrase.trim()}” may sound too casual for a ${guidelines.tone.toLowerCase()} brand tone.`,
        suggestion: "Rewrite the phrase using clear, brand-appropriate language."
      });

      const replacements = {
        "hey folks": "Hello",
        "hey guys": "Hello",
        "gonna": "going to",
        "awesome": "excellent",
        "wanna": "want to",
        "yo ": "Hello "
      };

      revised = revised.replace(
        new RegExp(escapeRegExp(phrase), "gi"),
        replacements[phrase]
      );

      score -= 10;
    }
  });

  if (text.trim().length < 35) {
    issues.push({
      type: "Insufficient context",
      severity: "Low",
      detail: "The content is very short, so its message and claims may be difficult to verify.",
      suggestion: "Add context or supporting information where appropriate."
    });

    score -= 5;
  }

  if (
    !/[.!?]$/.test(text.trim()) &&
    text.trim().length > 0
  ) {
    issues.push({
      type: "Writing consistency",
      severity: "Low",
      detail: "The content does not end with sentence punctuation.",
      suggestion: "Add appropriate punctuation at the end."
    });

    revised = revised.trim() + ".";

    score -= 3;
  }

  score = Math.max(0, Math.min(100, score));

  if (issues.length === 0) {
    issues.push({
      type: "No demo rule violations found",
      severity: "Info",
      detail: "The content passed the sample checks configured in this browser.",
      suggestion: "A human reviewer should still verify factual accuracy and brand fit."
    });
  }

  return {
    issues,
    score,
    revised
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderReport(report) {
  $("report-empty").classList.add("hidden");
  $("report").classList.remove("hidden");

  $("score-value").innerHTML =
    `${report.score}<small>/100</small>`;

  $("score-bar").style.width =
    report.score + "%";

  $("report-status").textContent = "Needs review";

  $("report-status").className = "status pending";

  $("issues-count").textContent =
    `${report.issues.filter(i => i.severity !== "Info").length} issue(s) detected`;

  $("issues-list").innerHTML = report.issues.map(issue => {
    return `
      <div class="issue">
        <div class="issue-top">
          <strong>${escapeHTML(issue.type)}</strong>
          <span>${escapeHTML(issue.severity)}</span>
        </div>

        <p>
          ${escapeHTML(issue.detail)}
          <br>
          <b>Suggestion:</b>
          ${escapeHTML(issue.suggestion)}
        </p>
      </div>
    `;
  }).join("");

  $("suggested-text").textContent = report.revised;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

$("analyze-btn").addEventListener("click", () => {
  const text = $("content-text").value.trim();

  if (!text) {
    toast("Please enter content to analyze");
    $("content-text").focus();
    return;
  }

  const result = analyzeContent(text);

  currentReport = {
    id: Date.now(),

    title:
      $("content-title").value.trim() ||
      "Untitled content",

    original: text,
    score: result.score,
    issues: result.issues,
    revised: result.revised,
    status: "Needs review",
    date: new Date().toLocaleString()
  };

  renderReport(currentReport);

  toast("Analysis complete — please review the findings");
});

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);

    toast("Suggestion copied");

  } catch (e) {
    const area = document.createElement("textarea");

    area.value = text;

    document.body.appendChild(area);

    area.select();

    document.execCommand("copy");

    area.remove();

    toast("Suggestion copied");
  }
}

$("copy-suggestion").addEventListener("click", () => {
  if (currentReport) {
    copyText(currentReport.revised);
  }
});

function decide(status) {
  if (!currentReport) {
    toast("Analyze content first");
    return;
  }

  const item = {
    ...currentReport,
    status,
    date: new Date().toLocaleString()
  };

  historyItems.unshift(item);

  historyItems = historyItems.slice(0, 100);

  saveData();

  renderStats();
  renderHistory();

  $("report-status").textContent = status;

  $("report-status").className =
    "status " +
    (status === "Approved" ? "approved" : "rejected");

  $("approve-btn").disabled = true;
  $("reject-btn").disabled = true;

  $("approve-btn").style.opacity = ".55";
  $("reject-btn").style.opacity = ".55";

  toast("Human review decision saved: " + status);
}

$("approve-btn").addEventListener("click", () => {
  decide("Approved");
});

$("reject-btn").addEventListener("click", () => {
  decide("Rejected");
});

$("brand-color").addEventListener("input", () => {
  $("color-code").textContent =
    $("brand-color").value.toUpperCase();
});

$("save-guidelines").addEventListener("click", () => {
  guidelines = {
    brandName:
      $("brand-name").value.trim() || "Unnamed brand",

    tone: $("brand-tone").value,

    color: $("brand-color").value,

    approvedTerms:
      $("approved-terms").value
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean),

    blockedClaims:
      $("blocked-claims").value
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
  };

  saveData();

  renderStats();

  $("save-message").textContent = "Saved!";

  setTimeout(() => {
    $("save-message").textContent = "";
  }, 2200);

  toast("Brand guidelines saved");
});

function badge(status) {
  const cls =
    status === "Approved"
      ? "approved"
      : status === "Rejected"
        ? "rejected"
        : "pending";

  return `<span class="status ${cls}">${escapeHTML(status)}</span>`;
}

function renderStats() {
  $("stat-reviewed").textContent = historyItems.length;

  $("stat-approved").textContent =
    historyItems.filter(x => x.status === "Approved").length;

  $("stat-pending").textContent =
    historyItems.filter(x => x.status === "Needs review").length;

  $("stat-rules").textContent =
    4 + (guidelines.blockedClaims || []).length;
}

function renderHistory() {
  const rows = historyItems.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.title)}</strong></td>
      <td>${item.score}/100</td>
      <td>${item.issues.filter(i => i.severity !== "Info").length}</td>
      <td>${badge(item.status)}</td>
      <td>${escapeHTML(item.date)}</td>
    </tr>
  `).join("");

  $("history-table").innerHTML =
    rows ||
    '<tr><td colspan="5" class="empty">No history available yet.</td></tr>';

  const recent = historyItems.slice(0, 5).map(item => `
    <tr>
      <td><strong>${escapeHTML(item.title)}</strong></td>
      <td>${item.score}/100</td>
      <td>${badge(item.status)}</td>
      <td>${escapeHTML(item.date)}</td>
    </tr>
  `).join("");

  $("recent-table").innerHTML =
    recent ||
    '<tr><td colspan="4" class="empty">No reviews yet. Start by checking content.</td></tr>';
}

$("clear-history").addEventListener("click", () => {
  if (!historyItems.length) {
    toast("History is already empty");
    return;
  }

  if (confirm("Clear all saved review history from this browser?")) {
    historyItems = [];

    saveData();

    renderStats();
    renderHistory();

    toast("History cleared");
  }
});

loadData();