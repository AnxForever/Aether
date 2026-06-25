/**
 * Onboarding JavaScript - Client-side logic
 */

// State
let currentStepIndex = 0;
let configuredProviders = [];
let validatedKeys = {};
let selectedModel = null;

// Steps
const steps = ['welcome', 'api-keys', 'model-selection', 'quick-tour', 'complete'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeProviderCheckboxes();
  updateProgress();
});

/**
 * Initialize provider checkboxes
 */
function initializeProviderCheckboxes() {
  const providers = ['claude', 'openai', 'gemini', 'minimax', 'moonshot', 'glm', 'deepseek'];

  providers.forEach(provider => {
    const checkbox = document.getElementById(`provider-${provider}`);
    const inputDiv = document.getElementById(`input-${provider}`);

    if (checkbox && inputDiv) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          inputDiv.classList.remove('hidden');
        } else {
          inputDiv.classList.add('hidden');
          // Remove from validated keys
          delete validatedKeys[provider];
          updateNextButtonState();
        }
      });
    }
  });
}

/**
 * Update progress bar
 */
function updateProgress() {
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;
}

/**
 * Next step
 */
function nextStep() {
  // Validation
  if (currentStepIndex === 1 && Object.keys(validatedKeys).length === 0) {
    alert('Please configure at least one API key');
    return;
  }

  if (currentStepIndex === 2 && !selectedModel) {
    alert('Please select a default model');
    return;
  }

  // Hide current step
  document.getElementById(`step-${steps[currentStepIndex]}`).classList.add('hidden');

  // Move to next
  currentStepIndex++;

  // Special handling for model selection step
  if (steps[currentStepIndex] === 'model-selection') {
    populateModels();
  }

  // Show next step
  document.getElementById(`step-${steps[currentStepIndex]}`).classList.remove('hidden');

  // Update progress
  updateProgress();
}

/**
 * Previous step
 */
function previousStep() {
  // Hide current step
  document.getElementById(`step-${steps[currentStepIndex]}`).classList.add('hidden');

  // Move to previous
  currentStepIndex--;

  // Show previous step
  document.getElementById(`step-${steps[currentStepIndex]}`).classList.remove('hidden');

  // Update progress
  updateProgress();
}

/**
 * Validate API key
 */
async function validateKey(provider) {
  const input = document.querySelector(`input[data-provider="${provider}"]`);
  const statusEl = input.parentElement.querySelector('.validation-status');
  const validateBtn = input.parentElement.querySelector('.btn-validate');

  if (!input.value || input.value.trim().length === 0) {
    statusEl.textContent = 'Required';
    statusEl.className = 'validation-status invalid';
    return;
  }

  // Disable button during validation
  validateBtn.disabled = true;
  statusEl.textContent = 'Validating...';
  statusEl.className = 'validation-status';

  try {
    const result = await window.electronAPI.validateAPIKey(provider, input.value);

    if (result.valid) {
      statusEl.textContent = '✓ Valid';
      statusEl.className = 'validation-status valid';
      validatedKeys[provider] = input.value;

      // Save API key
      await window.electronAPI.saveAPIKey(provider, input.value);

      if (!configuredProviders.includes(provider)) {
        configuredProviders.push(provider);
      }
    } else {
      statusEl.textContent = result.error || 'Invalid';
      statusEl.className = 'validation-status invalid';
      delete validatedKeys[provider];
    }
  } catch (error) {
    statusEl.textContent = 'Error';
    statusEl.className = 'validation-status invalid';
    console.error('Validation error:', error);
  } finally {
    validateBtn.disabled = false;
    updateNextButtonState();
  }
}

/**
 * Update next button state
 */
function updateNextButtonState() {
  const nextBtn = document.getElementById('btn-next-keys');
  if (nextBtn) {
    nextBtn.disabled = Object.keys(validatedKeys).length === 0;
  }
}

/**
 * Populate models based on configured providers
 */
function populateModels() {
  const modelsGrid = document.getElementById('modelsGrid');
  modelsGrid.innerHTML = '';

  const modelsByProvider = {
    claude: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', features: ['200K context', 'Vision', 'Fast'] },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', features: ['200K context', 'Vision', 'Best reasoning'] },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', features: ['128K context', 'Vision', 'Fast'] },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', features: ['128K context', 'Function calling'] },
    ],
    gemini: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', features: ['1M context', 'Multimodal', 'Fast'] },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', features: ['2M context', 'Vision'] },
    ],
    minimax: [
      { id: 'abab6.5-chat', name: 'abab6.5 Chat', features: ['Chinese', '8K context'] },
    ],
    moonshot: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', features: ['Chinese', '8K context'] },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', features: ['Chinese', '128K context'] },
    ],
    glm: [
      { id: 'glm-4', name: 'GLM-4', features: ['Chinese', '128K context'] },
    ],
    deepseek: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', features: ['Code', '32K context'] },
    ],
  };

  configuredProviders.forEach(provider => {
    const models = modelsByProvider[provider] || [];

    models.forEach(model => {
      const card = document.createElement('div');
      card.className = 'model-card';
      card.onclick = () => selectModel(model.id, card);

      card.innerHTML = `
        <h3>${model.name}</h3>
        <div class="model-provider">${provider.toUpperCase()}</div>
        <div class="model-features">
          ${model.features.map(f => `<span class="model-feature-tag">${f}</span>`).join('')}
        </div>
      `;

      modelsGrid.appendChild(card);
    });
  });

  // Select first model by default
  if (modelsGrid.children.length > 0) {
    const firstCard = modelsGrid.children[0];
    const firstModelId = modelsByProvider[configuredProviders[0]][0].id;
    selectModel(firstModelId, firstCard);
  }
}

/**
 * Select model
 */
function selectModel(modelId, cardElement) {
  // Remove selection from all cards
  document.querySelectorAll('.model-card').forEach(card => {
    card.classList.remove('selected');
  });

  // Select this card
  cardElement.classList.add('selected');
  selectedModel = modelId;

  // Enable next button
  const nextBtn = document.getElementById('btn-next-model');
  if (nextBtn) {
    nextBtn.disabled = false;
  }
}

/**
 * Complete onboarding
 */
async function completeOnboarding() {
  try {
    const completionData = {
      selectedProviders: configuredProviders,
      defaultModel: selectedModel,
      language: 'en',
      theme: 'auto',
      tourCompleted: currentStepIndex >= 3,
      completedAt: Date.now(),
    };

    await window.electronAPI.completeOnboarding(completionData);

    // Show completion summary
    showCompletionSummary(completionData);

    // Move to complete step
    document.getElementById(`step-${steps[currentStepIndex]}`).classList.add('hidden');
    currentStepIndex = steps.indexOf('complete');
    document.getElementById('step-complete').classList.remove('hidden');
    updateProgress();
  } catch (error) {
    console.error('Failed to complete onboarding:', error);
    alert('Failed to complete onboarding. Please try again.');
  }
}

/**
 * Show completion summary
 */
function showCompletionSummary(data) {
  const summaryEl = document.getElementById('completionSummary');

  summaryEl.innerHTML = `
    <div class="completion-item">
      <span class="completion-label">Providers configured:</span>
      <span class="completion-value">${data.selectedProviders.length}</span>
    </div>
    <div class="completion-item">
      <span class="completion-label">Default model:</span>
      <span class="completion-value">${data.defaultModel}</span>
    </div>
    <div class="completion-item">
      <span class="completion-label">Quick tour:</span>
      <span class="completion-value">${data.tourCompleted ? 'Completed' : 'Skipped'}</span>
    </div>
  `;
}

/**
 * Skip entire onboarding
 */
async function skipOnboarding() {
  if (confirm('Are you sure you want to skip setup? You can configure Aether later in Settings.')) {
    try {
      await window.electronAPI.skipOnboarding();
      launchApp();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  }
}

/**
 * Launch main app
 */
function launchApp() {
  // The main window will be opened automatically by the main process
  // when onboarding is completed or skipped
}
