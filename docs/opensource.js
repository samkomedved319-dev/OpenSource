/* ============================================================================
   openSource — Premium Landing Page Controller (opensource.js)
   Typewriter CLI Simulator · Multi-Scenario tabs · Connection Handshake · Accordion Toggles
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Accordion Toggle System ──────────────────────────────────────────
  const accordions = document.querySelectorAll('.accordion-item');
  accordions.forEach(acc => {
    const trigger = acc.querySelector('.accordion-trigger');
    trigger.addEventListener('click', () => {
      const isActive = acc.classList.contains('active');
      
      // Close all accordions first
      accordions.forEach(item => item.classList.remove('active'));
      
      // If was not active, open it
      if (!isActive) {
        acc.classList.add('active');
      }
    });
  });

  // Open first accordion by default
  if (accordions.length > 0) {
    accordions[0].classList.add('active');
  }

  // ── 2. Terminal Typewriter Simulation (Multi-Scenario) ──────────────────
  const terminalElement = document.getElementById('typewriter-terminal');
  
  const scenarios = {
    api: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource \"create a Fastify user signup API route with Zod validation\"\n", type: "cmd", delay: 1200 },
      { text: "  ✔ Establishing secure gateway connection (port 3100)\n", type: "success", delay: 350 },
      { text: "  ◈ Ingested workspace: 12 source files found\n", type: "bold", delay: 200 },
      { text: "  ⠏ thinking: loading Source PRO to synthesize Fastify router schema...\n", type: "dim", delay: 800 },
      { text: "  ✔ Plan created: [1/1] Create src/routes/signup.ts\n\n", type: "success", delay: 400 },
      { text: "  [NEW] src/routes/signup.ts:\n", type: "bold", delay: 200 },
      { text: "  ```typescript\n  import { FastifyInstance } from 'fastify';\n  import { z } from 'zod';\n\n  export async function signupRoute(fastify: FastifyInstance) {\n    fastify.post('/signup', {\n      schema: {\n        body: z.object({\n          email: z.string().email(),\n          password: z.string().min(8)\n        })\n      }\n    }, async (request, reply) => {\n      // Signup logic here...\n      return { status: 'registered' };\n    });\n  }\n  ```\n\n", type: "code", delay: 1500 },
      { text: "  ✔ File src/routes/signup.ts successfully created.\n", type: "success", delay: 400 },
      { text: "  You › ", type: "prompt", delay: 1000 }
    ],
    refactor: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource \"refactor list_directory tool in src/tools/file.ts to protect user homes\"\n", type: "cmd", delay: 1200 },
      { text: "  ◈ Ingesting src/tools/file.ts...\n", type: "dim", delay: 350 },
      { text: "  ✔ Ingestion complete: 284 lines scanned\n", type: "success", delay: 250 },
      { text: "  ⠏ thinking: preparing SEARCH/REPLACE block for depth check...\n", type: "dim", delay: 900 },
      { text: "  Applied changes to src/tools/file.ts:\n", type: "bold", delay: 200 },
      { text: "  <<<<<<< SEARCH\n  handler: async (args, context) => {\n    const targetPath = resolvePath(args.path);\n  =======\n  handler: async (args, context) => {\n    const targetPath = resolvePath(args.path);\n    if (isUserHome(targetPath)) {\n      throw new Error('Depth 0 directory scans blocked for security.');\n    }\n  >>>>>>> REPLACE\n\n", type: "code", delay: 1500 },
      { text: "  ✔ Successfully updated src/tools/file.ts.\n", type: "success", delay: 400 },
      { text: "  You › ", type: "prompt", delay: 1000 }
    ],
    doctor: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource doctor\n", type: "cmd", delay: 1200 },
      { text: "  ◈ Scanning Workspace Files & NPM Diagnostics...\n", type: "dim", delay: 450 },
      { text: "  ✖ Warning: 2 outdated libraries detected in package.json\n", type: "warn", delay: 300 },
      { text: "  ⠏ thinking: checking vulnerabilities for outdated dependencies...\n", type: "dim", delay: 900 },
      { text: "  ✔ Fixed: updated express from 4.18.0 to 4.21.1\n", type: "success", delay: 400 },
      { text: "  ✔ Fixed: resolved prototype pollution in dependency tree\n\n", type: "success", delay: 500 },
      { text: "  ✔ Verification compilation: OK (0 errors, 0 warnings)\n", type: "success", delay: 800 },
      { text: "  You › ", type: "prompt", delay: 1000 }
    ],
    commit: [
      { text: "PS C:\\Users\\samko> ", type: "prompt" },
      { text: "opensource --agent commit \"add auth guard check\"\n", type: "cmd", delay: 1200 },
      { text: "  ◈ Analyzing git diff statistics...\n", type: "dim", delay: 300 },
      { text: "  ✔ Found 1 modified file: src/tools/file.ts\n", type: "success", delay: 200 },
      { text: "  ⠏ thinking: generating semantic commit summary from diffs...\n", type: "dim", delay: 800 },
      { text: "  ✔ Generated Commit message: 'feat(tools): add home directory depth guard to list_directory'\n", type: "success", delay: 450 },
      { text: "  ✔ Git transaction complete (hash: a8f4b23)\n", type: "success", delay: 500 },
      { text: "  ✔ Pushed upstream to repository: samkomedved319-dev/OpenSource\n", type: "success", delay: 900 },
      { text: "  You › ", type: "prompt", delay: 1000 }
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
      // Loop with delay
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
    else if (currentStep.type === "warn") span.className = "t-warn";
    else if (currentStep.type === "dim") span.className = "t-dim";
    else if (currentStep.type === "bold") span.className = "t-h1";
    else if (currentStep.type === "code") span.className = "t-dim";

    // Set colors directly for warning if needed
    if (currentStep.type === "warn") {
      span.style.color = "#f43f5e";
    }

    terminalElement.appendChild(span);
    
    // Add flashing cursor at the end
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    terminalElement.appendChild(cursor);

    if (currentStep.type === "cmd") {
      // Type character-by-character
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
      // Print chunk instantly
      span.textContent = currentStep.text;
      scenarioIndex++;
      cursor.remove();
      typewriterTimeout = setTimeout(runTypewriter, currentStep.delay || 150);
    }
  }

  // Handle Tab clicks
  const playTabs = document.querySelectorAll('.play-tab');
  playTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs
      playTabs.forEach(t => t.classList.remove('active'));
      // Activate clicked tab
      tab.classList.add('active');
      
      // Stop active typewriter timeouts
      if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
      }
      
      // Switch scenario
      activeScenario = tab.getAttribute('data-scenario') || "api";
      
      // Reset terminal
      terminalElement.innerHTML = "";
      scenarioIndex = 0;
      charIndex = 0;
      
      // Start typing new scenario
      runTypewriter();
    });
  });

  // Launch terminal simulation
  if (terminalElement) {
    runTypewriter();
  }

  // ── 3. Connection Portal Handshake & Dashboard Morph ───────────────────
  const loginForm = document.getElementById('login-form');
  const portalContainer = document.getElementById('portal-container');
  const stateLogin = document.getElementById('state-login');
  const stateDashboard = document.getElementById('state-dashboard');
  const usernameInput = document.getElementById('username');
  const userDisplay = document.getElementById('user-display');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const submitBtn = document.getElementById('login-submit-btn');

  // Stats elements
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

      // 1. Show interactive button state loading
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
          
          // 2. Perform smooth transition morph
          stateLogin.style.opacity = '0';
          stateLogin.style.transform = 'scale(0.95)';
          
          setTimeout(() => {
            stateLogin.classList.add('hidden');
            stateDashboard.classList.remove('hidden');
            
            // Trigger entry animation
            stateDashboard.style.opacity = '0';
            stateDashboard.style.transform = 'scale(0.98)';
            
            // Set profile data
            userDisplay.textContent = username;
            
            setTimeout(() => {
              stateDashboard.style.opacity = '1';
              stateDashboard.style.transform = 'scale(1)';
              
              // 3. Animate metrics & sync bar counters
              animateDashboardStats();
              
              // 4. Start Event Stream Sim
              startLiveEventStream();
            }, 50);

            // Re-enable form button for potential future runs
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

    // Reset stats
    countNotesElement.textContent = "0";
    countTagsElement.textContent = "0";
    syncProgressElement.style.width = "0%";
    syncProgressElement.style.transition = "width 2s cubic-bezier(0.16, 1, 0.3, 1)";
    syncMsgElement.textContent = "✔ Syncing notes index...";

    // Count notes up to 142
    let notesCount = 0;
    const notesInterval = setInterval(() => {
      if (notesCount < 142) {
        notesCount += Math.floor(Math.random() * 8) + 1;
        if (notesCount > 142) notesCount = 142;
        countNotesElement.textContent = notesCount.toString();
      } else {
        clearInterval(notesInterval);
      }
    }, 40);

    // Count tags up to 34
    let tagsCount = 0;
    const tagsInterval = setInterval(() => {
      if (tagsCount < 34) {
        tagsCount += Math.floor(Math.random() * 3) + 1;
        if (tagsCount > 34) tagsCount = 34;
        countTagsElement.textContent = tagsCount.toString();
      } else {
        clearInterval(tagsInterval);
      }
    }, 60);

    // Animate Progress Bar
    setTimeout(() => {
      syncProgressElement.style.width = "100%";
      setTimeout(() => {
        syncMsgElement.textContent = "✔ Index fully aligned (100%)";
      }, 2000);
    }, 100);
  }

  function startLiveEventStream() {
    if (!eventStreamElement) return;

    // Clear and add system connect log
    eventStreamElement.innerHTML = '<div class="event-line system">[system] gateway connection established on port 3100</div>';

    const events = [
      { msg: "[handshake] session validated: agent alias 'samko' active", class: "handshake" },
      { msg: "[memory] loading index: scanning local Obsidian knowledge database...", class: "memory" },
      { msg: "[memory] parsed: 142 notes and 34 tags cataloged successfully", class: "memory" },
      { msg: "[workspace] dynamic scan target directory: root folder ./src detected", class: "workspace" },
      { msg: "[mcp] initializing MCP Client SDK server list...", class: "mcp" },
      { msg: "[agent] loading Source PRO LLM model layers into Ollama memory...", class: "agent" },
      { msg: "[system] active context initialized. Ready for task inputs.", class: "system" }
    ];

    // Clear past timers
    streamTimers.forEach(clearTimeout);
    streamTimers = [];

    // Progressive append
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

  // Disconnect button handler
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      stateDashboard.style.opacity = '0';
      stateDashboard.style.transform = 'scale(0.95)';

      // Clear stream timers
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

  // Interactive dashboard model selectors
  const modelItems = document.querySelectorAll('.model-item');
  modelItems.forEach(item => {
    item.addEventListener('click', () => {
      modelItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');
    });
  });


  // ── 4. Interactive CLI Command Builder ─────────────────────────────────
  const builderAgent = document.getElementById('builder-agent');
  const builderModel = document.getElementById('builder-model');
  const flagPlan = document.getElementById('flag-plan');
  const flagAuto = document.getElementById('flag-auto');
  const flagVerbose = document.getElementById('flag-verbose');
  const builderInputPrompt = document.getElementById('builder-input-prompt');
  const generatedCommand = document.getElementById('generated-command');
  const btnCopyCommand = document.getElementById('btn-copy-command');

  function updateGeneratedCommand() {
    if (!generatedCommand) return;

    const agent = builderAgent ? builderAgent.value : 'coder';
    const model = builderModel ? builderModel.value : 'Source PRO';
    const showPlan = flagPlan ? flagPlan.checked : true;
    const isAuto = flagAuto ? flagAuto.checked : false;
    const isVerbose = flagVerbose ? flagVerbose.checked : false;
    
    let rawPrompt = builderInputPrompt ? builderInputPrompt.value.trim() : 'my task';
    if (!rawPrompt) rawPrompt = "my task";
    
    // Sanitize quotes in prompt
    const cleanPrompt = rawPrompt.replace(/"/g, '\\"');

    // Build command string
    let cmd = `opensource "${cleanPrompt}" --agent ${agent} -m "${model}"`;
    if (showPlan) cmd += " --plan";
    if (isAuto) cmd += " --auto";
    if (isVerbose) cmd += " --verbose";

    generatedCommand.textContent = cmd;
  }

  // Bind Listeners
  const builderInputs = [builderAgent, builderModel, flagPlan, flagAuto, flagVerbose, builderInputPrompt];
  builderInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', updateGeneratedCommand);
      input.addEventListener('change', updateGeneratedCommand);
    }
  });

  // Copy command to clipboard
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
      }).catch(err => {
        console.error("Clipboard copy failed:", err);
      });
    });
  }

  // ── 5. GPU VRAM & Training Estimator Logic ─────────────────────────────
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

  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function calculateEstimates() {
    if (!estModelSize || !estMethod || !estDatasetSize) return;

    const size = parseInt(estModelSize.value, 10); // 5, 7, 14, 32
    const method = estMethod.value; // lora4, lora8, full16
    const datasetSize = parseInt(estDatasetSize.value, 10);

    // Update dataset display text
    if (datasetSizeVal) {
      datasetSizeVal.textContent = formatNumber(datasetSize);
    }

    // 1. Calculate VRAM requirement
    let vram = 0;
    if (method === 'lora4') {
      vram = size * 0.7 + 2.5;
    } else if (method === 'lora8') {
      vram = size * 1.1 + 3.5;
    } else if (method === 'full16') {
      vram = size * 4.0 + 8.0;
    }
    vram = parseFloat(vram.toFixed(1));

    if (estVramVal) {
      estVramVal.textContent = `${vram} GB`;
    }

    // 2. Set safety badges & recommended hardware
    let gpu = "";
    let gpuDesc = "";
    let safetyText = "";
    let safetyClass = "";
    let feasibilityVal = "";
    let feasibilityText = "";
    let feasibilityClass = "";

    if (vram <= 12) {
      gpu = "NVIDIA RTX 3060 / 4060 Ti (16GB)";
      gpuDesc = "Low cost. Runs comfortably on modern standard gaming desktop setups.";
      safetyText = "Consumer GPU Safe";
      safetyClass = "badge-green";
      feasibilityVal = "Low Cost";
      feasibilityText = "Highly Feasible";
      feasibilityClass = "badge-green";
    } else if (vram <= 24) {
      gpu = "NVIDIA RTX 4090 / 3090 (24GB)";
      gpuDesc = "High-end consumer setup. Perfect for enthusiast single-GPU setups.";
      safetyText = "Flagship GPU Required";
      safetyClass = "badge-orange";
      feasibilityVal = "Moderate Cost";
      feasibilityText = "Very Feasible";
      feasibilityClass = "badge-green";
    } else if (vram <= 48) {
      gpu = "NVIDIA RTX 6000 Ada / Dual RTX 3090";
      gpuDesc = "Professional workstation setup. Requires dual consumer or pro workstation cards.";
      safetyText = "Workstation Grade";
      safetyClass = "badge-orange";
      feasibilityVal = "Professional";
      feasibilityText = "Requires Budget";
      feasibilityClass = "badge-orange";
    } else {
      gpu = "NVIDIA A100 (80GB) / H100 (80GB)";
      gpuDesc = "Data-center hardware required. Ideal for cloud training nodes (RunPod, Lambda).";
      safetyText = "Enterprise Only";
      safetyClass = "badge-red";
      feasibilityVal = "Enterprise";
      feasibilityText = "High Cost (Cloud recommended)";
      feasibilityClass = "badge-red";
    }

    if (estVramBadge) {
      estVramBadge.className = `est-card-badge ${safetyClass}`;
      estVramBadge.textContent = safetyText;
    }
    if (estGpuVal) estGpuVal.textContent = gpu;
    if (estGpuDesc) estGpuDesc.textContent = gpuDesc;

    if (estFeasibilityVal) estFeasibilityVal.textContent = feasibilityVal;
    if (estFeasibilityBadge) {
      estFeasibilityBadge.className = `est-card-badge ${feasibilityClass}`;
      estFeasibilityBadge.textContent = feasibilityText;
    }

    // 3. Estimate Training Time
    // Base speed on RTX 4090:
    // Qwen-7B 4-bit LoRA takes ~10 examples/sec.
    // Scales: 4-bit LoRA: 10 ex/s, 8-bit LoRA: 6 ex/s, Full 16-bit: 1.5 ex/s.
    // Scales with size: 7B is baseline (1x). 5B is 1.4x faster. 14B is 2x slower. 32B is 4.5x slower.
    let baseSpeed = 10; // examples/sec for 7B 4-bit LoRA
    if (method === 'lora8') baseSpeed = 6;
    if (method === 'full16') baseSpeed = 1.5;

    let sizeFactor = 1;
    if (size === 5) sizeFactor = 0.7;
    if (size === 7) sizeFactor = 1.0;
    if (size === 14) sizeFactor = 2.0;
    if (size === 32) sizeFactor = 4.5;

    const speed = baseSpeed / sizeFactor; // examples/sec
    const totalSecs = (datasetSize / speed) * 3; // Assume 3 epochs
    const totalMins = Math.round(totalSecs / 60);

    let timeText = "";
    if (totalMins < 60) {
      timeText = `~${totalMins} min`;
    } else {
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      timeText = `~${hrs}h ${mins}m`;
    }

    if (estTimeVal) estTimeVal.textContent = timeText;
    if (estTimeDesc) {
      estTimeDesc.textContent = `Calculated for 3 epochs training run on a single RTX 4090 GPU node (${speed.toFixed(1)} ex/s).`;
    }
  }

  // Bind Listeners
  if (estModelSize) estModelSize.addEventListener('change', calculateEstimates);
  if (estMethod) estMethod.addEventListener('change', calculateEstimates);
  if (estDatasetSize) {
    estDatasetSize.addEventListener('input', calculateEstimates);
    estDatasetSize.addEventListener('change', calculateEstimates);
  }

  // Initial trigger
  calculateEstimates();

  // Trigger initial render
  updateGeneratedCommand();

});
