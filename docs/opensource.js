/* ============================================================================
   OpenSource — Premium Landing Page Controller v2.0
   Typewriter · Multi-Scenario · Connection Portal · Accordion · Builder · Scroll
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── 0. Scroll to Top Button ─────────────────────────────────────────────
  const scrollTopBtn = document.getElementById('scroll-top');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  });
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Sticky Header ───────────────────────────────────────────────────────
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // ── Hamburger Menu ──────────────────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('main-nav');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mainNav.classList.toggle('open');
  });
  // Close on nav link click
  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mainNav.classList.remove('open');
    });
  });

  // ── 1. Install Tabs ────────────────────────────────────────────────────
  const installTabs = document.querySelectorAll('.install-tab');
  installTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      installTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.install-content').forEach(c => c.classList.remove('active'));
      const platform = tab.getAttribute('data-platform');
      const target = document.getElementById('install-' + platform);
      if (target) target.classList.add('active');
    });
  });

  // ── 2. Accordion Toggle System ──────────────────────────────────────────
  const accordions = document.querySelectorAll('.accordion-item');
  accordions.forEach(acc => {
    const trigger = acc.querySelector('.accordion-trigger');
    trigger.addEventListener('click', () => {
      const isActive = acc.classList.contains('active');
      accordions.forEach(item => item.classList.remove('active'));
      if (!isActive) acc.classList.add('active');
    });
  });
  if (accordions.length > 0) accordions[0].classList.add('active');

  // ── 3. Terminal Typewriter Simulation ──────────────────────────────────
  const terminalElement = document.getElementById('typewriter-terminal');

  const scenarios = {
    api: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource \"create a Fastify user signup API route with Zod validation\"\n", type: "cmd", delay: 1200 },
      { text: "  \u2714 Establishing secure gateway connection (port 3100)\n", type: "success", delay: 350 },
      { text: "  \u25C8 Ingested workspace: 12 source files found\n", type: "bold", delay: 200 },
      { text: "  \u280F thinking: loading Source PRO to synthesize Fastify router schema...\n", type: "dim", delay: 800 },
      { text: "  \u2714 Plan created: [1/1] Create src/routes/signup.ts\n\n", type: "success", delay: 400 },
      { text: "  [NEW] src/routes/signup.ts:\n", type: "bold", delay: 200 },
      { text: "  ```typescript\n  import { FastifyInstance } from 'fastify';\n  import { z } from 'zod';\n\n  export async function signupRoute(fastify: FastifyInstance) {\n    fastify.post('/signup', {\n      schema: {\n        body: z.object({\n          email: z.string().email(),\n          password: z.string().min(8)\n        })\n      }\n    }, async (request, reply) => {\n      return { status: 'registered' };\n    });\n  }\n  ```\n\n", type: "code", delay: 1500 },
      { text: "  \u2714 File src/routes/signup.ts successfully created.\n", type: "success", delay: 400 },
      { text: "  \u280F thinking: verifying TypeScript compilation...\n", type: "dim", delay: 600 },
      { text: "  \u2714 Compilation OK (0 errors)\n", type: "success", delay: 300 },
      { text: "  You \u203A ", type: "prompt", delay: 1000 }
    ],
    refactor: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource \"refactor list_directory tool to protect user homes\"\n", type: "cmd", delay: 1200 },
      { text: "  \u25C8 Ingesting src/tools/file.ts...\n", type: "dim", delay: 350 },
      { text: "  \u2714 Ingestion complete: 284 lines scanned\n", type: "success", delay: 250 },
      { text: "  \u280F thinking: preparing SEARCH/REPLACE block for depth check...\n", type: "dim", delay: 900 },
      { text: "  Applied changes to src/tools/file.ts:\n", type: "bold", delay: 200 },
      { text: "  <<<<<<< SEARCH\n  handler: async (args, context) => {\n    const targetPath = resolvePath(args.path);\n  =======\n  handler: async (args, context) => {\n    const targetPath = resolvePath(args.path);\n    if (isUserHome(targetPath)) {\n      throw new Error('Depth 0 scans blocked for security.');\n    }\n  >>>>>>> REPLACE\n\n", type: "code", delay: 1500 },
      { text: "  \u2714 Successfully updated src/tools/file.ts.\n", type: "success", delay: 400 },
      { text: "  \u280F thinking: verifying no regressions...\n", type: "dim", delay: 600 },
      { text: "  \u2714 All tests pass\n", type: "success", delay: 300 },
      { text: "  You \u203A ", type: "prompt", delay: 1000 }
    ],
    doctor: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource doctor\n", type: "cmd", delay: 1200 },
      { text: "  \u25C8 Scanning Workspace & NPM Diagnostics...\n", type: "dim", delay: 450 },
      { text: "  \u2714 Ollama reachable — 4 model(s) available\n", type: "success", delay: 300 },
      { text: "  \u2714 Memory system: SQLite active\n", type: "success", delay: 250 },
      { text: "  \u26A0 Warning: 2 outdated libraries in package.json\n", type: "warn", delay: 300 },
      { text: "  \u280F thinking: checking vulnerabilities...\n", type: "dim", delay: 900 },
      { text: "  \u2714 Fixed: updated express 4.18.0 \u2192 4.21.1\n", type: "success", delay: 400 },
      { text: "  \u2714 Fixed: resolved prototype pollution\n\n", type: "success", delay: 500 },
      { text: "  \u2714 All checks passed (0 critical, 2 fixed)\n", type: "success", delay: 800 },
      { text: "  You \u203A ", type: "prompt", delay: 1000 }
    ],
    commit: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource \"commit with message: add auth guard\"\n", type: "cmd", delay: 1200 },
      { text: "  \u25C8 Analyzing git diff statistics...\n", type: "dim", delay: 300 },
      { text: "  \u2714 Found 2 modified files\n", type: "success", delay: 200 },
      { text: "  \u280F thinking: generating semantic commit summary...\n", type: "dim", delay: 800 },
      { text: "  \u2714 Commit: 'feat(auth): add JWT guard and rate limiting'\n", type: "success", delay: 450 },
      { text: "  \u25C8 Changes: +124 / -18 lines\n", type: "dim", delay: 300 },
      { text: "  \u2714 Git transaction complete (hash: a8f4b23)\n", type: "success", delay: 400 },
      { text: "  \u2714 Pushed to samkomedved319-dev/OpenSource\n", type: "success", delay: 900 },
      { text: "  You \u203A ", type: "prompt", delay: 1000 }
    ]
  };

  let activeScenario = "api";
  let scenarioIndex = 0;
  let charIndex = 0;
  let typewriterTimeout = null;

  function runTypewriter() {
    if (!terminalElement) return;
    const currentScenario = scenarios[activeScenario];
    if (scenarioIndex >= currentScenario.length) {
      typewriterTimeout = setTimeout(() => {
        terminalElement.innerHTML = "";
        scenarioIndex = 0;
        charIndex = 0;
        runTypewriter();
      }, 5000);
      return;
    }
    const currentStep = currentScenario[scenarioIndex];
    const span = document.createElement("span");
    if (currentStep.type === "prompt") span.className = "t-prompt";
    else if (currentStep.type === "cmd") span.className = "t-cmd";
    else if (currentStep.type === "success") span.className = "t-success";
    else if (currentStep.type === "warn") { span.style.color = "#f43f5e"; }
    else if (currentStep.type === "dim") span.className = "t-dim";
    else if (currentStep.type === "bold") span.className = "t-h1";
    else if (currentStep.type === "code") span.className = "t-dim";

    terminalElement.appendChild(span);
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    terminalElement.appendChild(cursor);

    if (currentStep.type === "cmd") {
      function typeChar() {
        if (charIndex < currentStep.text.length) {
          span.textContent += currentStep.text.charAt(charIndex);
          charIndex++;
          typewriterTimeout = setTimeout(typeChar, 35 + Math.random() * 40);
        } else {
          charIndex = 0;
          scenarioIndex++;
          cursor.remove();
          typewriterTimeout = setTimeout(runTypewriter, currentStep.delay || 300);
        }
      }
      typeChar();
    } else {
      span.textContent = currentStep.text;
      scenarioIndex++;
      cursor.remove();
      typewriterTimeout = setTimeout(runTypewriter, currentStep.delay || 150);
    }
  }

  const playTabs = document.querySelectorAll('.play-tab');
  playTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      playTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (typewriterTimeout) clearTimeout(typewriterTimeout);
      activeScenario = tab.getAttribute('data-scenario') || "api";
      terminalElement.innerHTML = "";
      scenarioIndex = 0;
      charIndex = 0;
      runTypewriter();
    });
  });
  if (terminalElement) runTypewriter();

  // ── 4. Connection Portal Handshake & Dashboard ─────────────────────────
  const loginForm = document.getElementById('login-form');
  const stateLogin = document.getElementById('state-login');
  const stateDashboard = document.getElementById('state-dashboard');
  const usernameInput = document.getElementById('username');
  const userDisplay = document.getElementById('user-display');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const submitBtn = document.getElementById('login-submit-btn');
  const countNotesElement = document.getElementById('count-notes');
  const countTagsElement = document.getElementById('count-tags');
  const syncProgressElement = document.getElementById('sync-progress');
  const syncMsgElement = document.getElementById('sync-msg');
  const eventStreamElement = document.getElementById('event-stream');
  let streamTimers = [];

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim() || 'samko';
      const btnText = submitBtn.querySelector('.btn-text');
      const spinner = submitBtn.querySelector('.spinner-inline');
      btnText.textContent = "Connecting gateway...";
      spinner.classList.remove('hidden');
      submitBtn.setAttribute('disabled', 'true');

      const handshakes = [
        "Connecting local gateway (port 3100)...",
        "Handshaking with session agent...",
        "Querying local Ollama model catalog...",
        "Validating Obsidian Vault path...",
        "Ingesting codebase project structure..."
      ];
      let step = 0;
      const interval = setInterval(() => {
        if (step < handshakes.length) {
          btnText.textContent = handshakes[step];
          step++;
        } else {
          clearInterval(interval);
          stateLogin.style.opacity = '0';
          stateLogin.style.transform = 'scale(0.95)';
          setTimeout(() => {
            stateLogin.classList.add('hidden');
            stateDashboard.classList.remove('hidden');
            stateDashboard.style.opacity = '0';
            stateDashboard.style.transform = 'scale(0.98)';
            userDisplay.textContent = username;
            setTimeout(() => {
              stateDashboard.style.opacity = '1';
              stateDashboard.style.transform = 'scale(1)';
              animateDashboardStats();
              startLiveEventStream();
            }, 50);
            btnText.textContent = "Establish Secure Bridge";
            spinner.classList.add('hidden');
            submitBtn.removeAttribute('disabled');
          }, 300);
        }
      }, 500);
    });
  }

  function animateDashboardStats() {
    if (!countNotesElement || !countTagsElement || !syncProgressElement || !syncMsgElement) return;
    countNotesElement.textContent = "0";
    countTagsElement.textContent = "0";
    syncProgressElement.style.width = "0%";
    syncMsgElement.textContent = "\u2714 Syncing notes index...";
    let notesCount = 0;
    const notesInterval = setInterval(() => {
      if (notesCount < 142) {
        notesCount += Math.floor(Math.random() * 8) + 1;
        if (notesCount > 142) notesCount = 142;
        countNotesElement.textContent = notesCount.toString();
      } else { clearInterval(notesInterval); }
    }, 40);
    let tagsCount = 0;
    const tagsInterval = setInterval(() => {
      if (tagsCount < 34) {
        tagsCount += Math.floor(Math.random() * 3) + 1;
        if (tagsCount > 34) tagsCount = 34;
        countTagsElement.textContent = tagsCount.toString();
      } else { clearInterval(tagsInterval); }
    }, 60);
    setTimeout(() => {
      syncProgressElement.style.width = "100%";
      setTimeout(() => { syncMsgElement.textContent = "\u2714 Index fully aligned (100%)"; }, 2000);
    }, 100);
  }

  function startLiveEventStream() {
    if (!eventStreamElement) return;
    eventStreamElement.innerHTML = '<div class="event-line system">[system] gateway connection established on port 3100</div>';
    const events = [
      { msg: "[handshake] session validated: agent alias 'samko' active", class: "handshake" },
      { msg: "[memory] scanning local Obsidian knowledge database...", class: "memory" },
      { msg: "[memory] parsed: 142 notes and 34 tags cataloged", class: "memory" },
      { msg: "[workspace] dynamic scan: root folder ./src detected", class: "workspace" },
      { msg: "[mcp] initializing MCP Client SDK server list...", class: "mcp" },
      { msg: "[agent] loading Source PRO into Ollama memory...", class: "agent" },
      { msg: "[system] active context initialized. Ready for tasks.", class: "system" }
    ];
    streamTimers.forEach(clearTimeout);
    streamTimers = [];
    events.forEach((evt, idx) => {
      const timer = setTimeout(() => {
        const line = document.createElement("div");
        line.className = `event-line ${evt.class}`;
        line.textContent = evt.msg;
        eventStreamElement.appendChild(line);
        eventStreamElement.scrollTop = eventStreamElement.scrollHeight;
      }, 700 + idx * 800);
      streamTimers.push(timer);
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      stateDashboard.style.opacity = '0';
      stateDashboard.style.transform = 'scale(0.95)';
      streamTimers.forEach(clearTimeout);
      streamTimers = [];
      setTimeout(() => {
        stateDashboard.classList.add('hidden');
        stateLogin.classList.remove('hidden');
        stateLogin.style.opacity = '0';
        stateLogin.style.transform = 'scale(0.98)';
        setTimeout(() => {
          stateLogin.style.opacity = '1';
          stateLogin.style.transform = 'scale(1)';
        }, 50);
      }, 300);
    });
  }

  const modelItems = document.querySelectorAll('.model-item');
  modelItems.forEach(item => {
    item.addEventListener('click', () => {
      modelItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // ── 5. Interactive CLI Command Builder ─────────────────────────────────
  const builderAgent = document.getElementById('builder-agent');
  const builderModel = document.getElementById('builder-model');
  const flagPlan = document.getElementById('flag-plan');
  const flagAuto = document.getElementById('flag-auto');
  const flagNoScan = document.getElementById('flag-no-scan');
  const builderInputPrompt = document.getElementById('builder-input-prompt');
  const generatedCommand = document.getElementById('generated-command');
  const btnCopyCommand = document.getElementById('btn-copy-command');

  function updateGeneratedCommand() {
    if (!generatedCommand) return;
    const agent = builderAgent ? builderAgent.value : 'coder';
    const model = builderModel ? builderModel.value : 'Source PRO';
    const showPlan = flagPlan ? flagPlan.checked : true;
    const isAuto = flagAuto ? flagAuto.checked : false;
    const noScan = flagNoScan ? flagNoScan.checked : false;
    let rawPrompt = builderInputPrompt ? builderInputPrompt.value.trim() : 'my task';
    if (!rawPrompt) rawPrompt = "my task";
    const cleanPrompt = rawPrompt.replace(/"/g, '\\"');
    let cmd = `opensource "${cleanPrompt}" --agent ${agent} -m "${model}"`;
    if (showPlan) cmd += " --plan";
    if (isAuto) cmd += " --auto";
    if (noScan) cmd += " --no-scan";
    generatedCommand.textContent = cmd;
  }

  const builderInputs = [builderAgent, builderModel, flagPlan, flagAuto, flagNoScan, builderInputPrompt];
  builderInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', updateGeneratedCommand);
      input.addEventListener('change', updateGeneratedCommand);
    }
  });

  if (btnCopyCommand) {
    btnCopyCommand.addEventListener('click', () => {
      if (!generatedCommand) return;
      const cmdText = generatedCommand.textContent;
      navigator.clipboard.writeText(cmdText).then(() => {
        const originalText = btnCopyCommand.textContent;
        btnCopyCommand.textContent = "Copied!";
        btnCopyCommand.style.background = "var(--emerald)";
        btnCopyCommand.style.color = "var(--bg-dark)";
        setTimeout(() => {
          btnCopyCommand.textContent = originalText;
          btnCopyCommand.style.background = "";
          btnCopyCommand.style.color = "";
        }, 2000);
      }).catch(err => console.error("Clipboard copy failed:", err));
    });
  }

  updateGeneratedCommand();

  // ── 6. GPU VRAM Estimator ──────────────────────────────────────────────
  const estModelSize = document.getElementById('est-model-size');
  const estMethod = document.getElementById('est-method');
  const estDatasetSize = document.getElementById('est-dataset-size');
  const datasetSizeVal = document.getElementById('dataset-size-val');
  const estVramVal = document.getElementById('est-vram-val');
  const estVramBadge = document.getElementById('est-vram-badge');
  const estGpuVal = document.getElementById('est-gpu-val');
  const estGpuDesc = document.getElementById('est-gpu-desc');
  const estTimeVal = document.getElementById('est-time-val');
  const estTimeDesc = document.getElementById('est-time-desc');
  const estFeasibilityVal = document.getElementById('est-feasibility-val');
  const estFeasibilityBadge = document.getElementById('est-feasibility-badge');

  function calculateEstimates() {
    if (!estModelSize || !estMethod || !estDatasetSize) return;
    const size = parseInt(estModelSize.value, 10);
    const method = estMethod.value;
    const datasetSize = parseInt(estDatasetSize.value, 10);
    if (datasetSizeVal) datasetSizeVal.textContent = datasetSize.toLocaleString();

    let vram = 0;
    if (method === 'lora4') vram = size * 0.7 + 2.5;
    else if (method === 'lora8') vram = size * 1.1 + 3.5;
    else if (method === 'full16') vram = size * 4.0 + 8.0;
    vram = parseFloat(vram.toFixed(1));
    if (estVramVal) estVramVal.textContent = `${vram} GB`;

    let gpu, gpuDesc, safetyText, safetyClass, feasibilityVal, feasibilityText, feasibilityClass;
    if (vram <= 12) {
      gpu = "NVIDIA RTX 3060 / 4060 Ti (16GB)";
      gpuDesc = "Runs comfortably on modern standard gaming desktop setups.";
      safetyText = "Consumer GPU Safe"; safetyClass = "badge-green";
      feasibilityVal = "Low Cost"; feasibilityText = "Highly Feasible"; feasibilityClass = "badge-green";
    } else if (vram <= 24) {
      gpu = "NVIDIA RTX 4090 / 3090 (24GB)";
      gpuDesc = "High-end consumer setup for enthusiast single-GPU.";
      safetyText = "Flagship GPU Required"; safetyClass = "badge-orange";
      feasibilityVal = "Moderate Cost"; feasibilityText = "Very Feasible"; feasibilityClass = "badge-green";
    } else if (vram <= 48) {
      gpu = "NVIDIA RTX 6000 Ada / Dual RTX 3090";
      gpuDesc = "Professional workstation with dual cards.";
      safetyText = "Workstation Grade"; safetyClass = "badge-orange";
      feasibilityVal = "Professional"; feasibilityText = "Requires Budget"; feasibilityClass = "badge-orange";
    } else {
      gpu = "NVIDIA A100 (80GB) / H100 (80GB)";
      gpuDesc = "Data-center hardware (RunPod, Lambda, etc.).";
      safetyText = "Enterprise Only"; safetyClass = "badge-red";
      feasibilityVal = "Enterprise"; feasibilityText = "High Cost (Cloud recommended)"; feasibilityClass = "badge-red";
    }
    if (estVramBadge) { estVramBadge.className = `est-card-badge ${safetyClass}`; estVramBadge.textContent = safetyText; }
    if (estGpuVal) estGpuVal.textContent = gpu;
    if (estGpuDesc) estGpuDesc.textContent = gpuDesc;
    if (estFeasibilityVal) estFeasibilityVal.textContent = feasibilityVal;
    if (estFeasibilityBadge) { estFeasibilityBadge.className = `est-card-badge ${feasibilityClass}`; estFeasibilityBadge.textContent = feasibilityText; }

    let baseSpeed = 10;
    if (method === 'lora8') baseSpeed = 6;
    if (method === 'full16') baseSpeed = 1.5;
    let sizeFactor = 1;
    if (size === 5) sizeFactor = 0.7;
    if (size === 7) sizeFactor = 1.0;
    if (size === 14) sizeFactor = 2.0;
    if (size === 32) sizeFactor = 4.5;
    const speed = baseSpeed / sizeFactor;
    const totalSecs = (datasetSize / speed) * 3;
    const totalMins = Math.round(totalSecs / 60);
    let timeText = totalMins < 60 ? `~${totalMins} min` : `~${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
    if (estTimeVal) estTimeVal.textContent = timeText;
    if (estTimeDesc) estTimeDesc.textContent = `Calculated for 3 epochs on a single RTX 4090 (${speed.toFixed(1)} ex/s).`;
  }

  if (estModelSize) estModelSize.addEventListener('change', calculateEstimates);
  if (estMethod) estMethod.addEventListener('change', calculateEstimates);
  if (estDatasetSize) {
    estDatasetSize.addEventListener('input', calculateEstimates);
    estDatasetSize.addEventListener('change', calculateEstimates);
  }
  calculateEstimates();

});
