/* ============================================================================
   openSource CLI — Interactive Landing Page Controller (app.js)
   Typewriter CLI Simulator · Connection handshake · Accordion Toggles
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

  // ── 2. Terminal Typewriter Simulation ────────────────────────────────────
  const terminalElement = document.getElementById('typewriter-terminal');
  
  const terminalScenario = [
    { text: "PS C:\\Users\\samko> ", type: "prompt" },
    { text: "opensource --workdir ./nexus-cli\n", type: "cmd", delay: 1000 },
    { text: "  ✔ Estabishing secure connection to local gateway (port 3100)\n", type: "success", delay: 400 },
    { text: "  ✔ Pinging local Ollama model layer...\n", type: "success", delay: 300 },
    { text: "  ◈ Detected Workspace Structure:\n", type: "bold", delay: 300 },
    { text: "    ◈ nexus-cli/\n", type: "dim" },
    { text: "      ├── src/ (primary source)\n", type: "dim" },
    { text: "      │   ├── core/\n", type: "dim" },
    { text: "      │   │   ├── agent.ts\n", type: "dim" },
    { text: "      │   │   └── llm.ts\n", type: "dim" },
    { text: "      │   ├── tools/\n", type: "dim" },
    { text: "      │   │   └── file.ts\n", type: "dim" },
    { text: "      │   └── index.ts\n", type: "dim" },
    { text: "      ├── package.json\n", type: "dim" },
    { text: "      └── README.md\n\n", type: "dim", delay: 800 },
    { text: "  openSource CLI v1.1.0  ·  Ollama: Source PRO  ·  Type /help for commands\n\n", type: "success", delay: 1000 },
    { text: "  You › ", type: "prompt" },
    { text: "add a safety stats check to list_directory tool\n", type: "cmd", delay: 1200 },
    { text: "  openSource ›\n", type: "prompt", delay: 300 },
    { text: "  ⠏ thinking: scanning tools/file.ts for list_directory schema...\n", type: "dim", delay: 800 },
    { text: "  ✔ Completed: list_directory tool detected in src/tools/file.ts\n", type: "success", delay: 500 },
    { text: "  ⠏ thinking: preparing SEARCH/REPLACE blocks for stats guard...\n", type: "dim", delay: 900 },
    { text: "  ✔ Completed: modifications validated safely\n\n", type: "success", delay: 400 },
    { text: "  Applied changes to src/tools/file.ts:\n", type: "bold", delay: 200 },
    { text: "  <<<<<<< SEARCH\n  handler: async (args, context) => {\n    const dirPath = resolvePath(args.path, context);\n  =======\n  handler: async (args, context) => {\n    const dirPath = resolvePath(args.path, context);\n    const stats = statSync(dirPath);\n    if (!stats.isDirectory()) throw new Error('Not a directory');\n  >>>>>>> REPLACE\n\n", type: "code", delay: 1200 },
    { text: "  You › ", type: "prompt" },
    { text: "/commit \"feat: add stats guard to list_directory tool\"\n", type: "cmd", delay: 1000 },
    { text: "  openSource ›\n", type: "prompt", delay: 300 },
    { text: "  ✔ Completed: generated AI commit message\n", type: "success", delay: 400 },
    { text: "  ✔ Completed: git commit successfully created (hash: c4d2fa8)\n\n", type: "success", delay: 1500 },
  ];

  let scenarioIndex = 0;
  let charIndex = 0;

  function runTypewriter() {
    if (scenarioIndex >= terminalScenario.length) {
      // Loop with delay
      setTimeout(() => {
        terminalElement.innerHTML = "";
        scenarioIndex = 0;
        charIndex = 0;
        runTypewriter();
      }, 5000);
      return;
    }

    const currentStep = terminalScenario[scenarioIndex];
    const span = document.createElement("span");
    
    if (currentStep.type === "prompt") span.className = "t-prompt";
    else if (currentStep.type === "cmd") span.className = "t-cmd";
    else if (currentStep.type === "success") span.className = "t-success";
    else if (currentStep.type === "dim") span.className = "t-dim";
    else if (currentStep.type === "bold") span.className = "t-h1";
    else if (currentStep.type === "code") span.className = "t-dim";

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
          setTimeout(typeChar, 40 + Math.random() * 50);
        } else {
          charIndex = 0;
          scenarioIndex++;
          cursor.remove();
          setTimeout(runTypewriter, currentStep.delay || 300);
        }
      }
      typeChar();
    } else {
      // Print chunk instantly
      span.textContent = currentStep.text;
      scenarioIndex++;
      cursor.remove();
      setTimeout(runTypewriter, currentStep.delay || 150);
    }
  }

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

  // Disconnect button handler
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      stateDashboard.style.opacity = '0';
      stateDashboard.style.transform = 'scale(0.95)';

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

});
