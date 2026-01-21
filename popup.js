// Default settings
const defaults = {
  provider: 'ollama',
  targetLanguage: 'Chinese',
  modelName: 'llama3.2',
  ollamaUrl: 'http://localhost:11434',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini'
};

// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(defaults);

  document.getElementById('provider').value = settings.provider;
  document.getElementById('targetLanguage').value = settings.targetLanguage;
  document.getElementById('modelName').value = settings.modelName;
  document.getElementById('ollamaUrl').value = settings.ollamaUrl;
  document.getElementById('openaiApiKey').value = settings.openaiApiKey;
  document.getElementById('openaiModel').value = settings.openaiModel;

  // Show/hide provider-specific settings
  updateProviderUI(settings.provider);
});

// Handle provider change
document.getElementById('provider').addEventListener('change', (e) => {
  updateProviderUI(e.target.value);
});

// Show/hide settings based on provider
function updateProviderUI(provider) {
  const ollamaSettings = document.getElementById('ollamaSettings');
  const openaiSettings = document.getElementById('openaiSettings');

  if (provider === 'ollama') {
    ollamaSettings.style.display = 'block';
    openaiSettings.style.display = 'none';
  } else {
    ollamaSettings.style.display = 'none';
    openaiSettings.style.display = 'block';
  }
}

// Save settings
document.getElementById('saveBtn').addEventListener('click', async () => {
  const provider = document.getElementById('provider').value;
  const targetLanguage = document.getElementById('targetLanguage').value;
  const modelName = document.getElementById('modelName').value.trim();
  const ollamaUrl = document.getElementById('ollamaUrl').value.trim();
  const openaiApiKey = document.getElementById('openaiApiKey').value.trim();
  const openaiModel = document.getElementById('openaiModel').value;

  // Validate inputs based on provider
  if (provider === 'ollama') {
    if (!modelName) {
      showStatus('Please enter a model name', 'error');
      return;
    }
    if (!ollamaUrl) {
      showStatus('Please enter the Ollama API URL', 'error');
      return;
    }
  } else {
    if (!openaiApiKey) {
      showStatus('Please enter your OpenAI API key', 'error');
      return;
    }
    if (!openaiApiKey.startsWith('sk-')) {
      showStatus('Invalid API key format. It should start with "sk-"', 'error');
      return;
    }
  }

  try {
    // Save to Chrome storage
    await chrome.storage.sync.set({
      provider,
      targetLanguage,
      modelName,
      ollamaUrl,
      openaiApiKey,
      openaiModel
    });

    showStatus('Settings saved. Checking connection...', 'success');

    // Test connection based on provider
    if (provider === 'ollama') {
      await checkOllamaSettings();
    } else {
      await checkOpenAISettings();
    }
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
});

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }
}

// Ollama connection check
async function checkOllamaSettings() {
  const ollamaUrl = document.getElementById('ollamaUrl').value.trim();
  const modelName = document.getElementById('modelName').value.trim();

  if (!ollamaUrl) {
    showStatus('Please enter the Ollama API URL', 'error');
    return;
  }
  if (!modelName) {
    showStatus('Please enter a model name', 'error');
    return;
  }

  // Step 1: Check if Ollama is running
  try {
    const tagsResponse = await fetch(`${ollamaUrl}/api/tags`);
    if (!tagsResponse.ok) {
      showStatus('Ollama is not responding. Make sure it is running.', 'error');
      return;
    }

    // Check if model exists
    const data = await tagsResponse.json();
    const models = data.models || [];
    const modelExists = models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'));

    if (!modelExists) {
      const available = models.map(m => m.name.split(':')[0]).join(', ');
      showStatus(`Model "${modelName}" not found. Available: ${available}`, 'error');
      return;
    }

    // Step 2: Send a test message
    const testResponse = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: 'Say "OK" if you can read this.',
        stream: false,
        options: { temperature: 0 }
      })
    });

    if (testResponse.ok) {
      const result = await testResponse.json();
      if (result.response) {
        showStatus(`Ollama is working! Response: "${result.response.trim().substring(0, 50)}"`, 'success');
      } else {
        showStatus('Ollama responded but with empty result.', 'error');
      }
    } else {
      showStatus('Ollama test message failed.', 'error');
    }
  } catch (error) {
    // Check if it's a CORS error
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      showStatus('Cannot connect to Ollama. Check if OLLAMA_ORIGINS is set (e.g., OLLAMA_ORIGINS=* ollama serve)', 'error');
    } else {
      showStatus('Error: ' + error.message, 'error');
    }
  }
}

// Comprehensive OpenAI check
async function checkOpenAISettings() {
  const apiKey = document.getElementById('openaiApiKey').value.trim();
  const model = document.getElementById('openaiModel').value;

  if (!apiKey) {
    showStatus('Please enter your OpenAI API key', 'error');
    return;
  }

  if (!apiKey.startsWith('sk-')) {
    showStatus('Invalid API key format. It should start with "sk-"', 'error');
    return;
  }

  try {
    // Send a minimal test message
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices[0]?.message?.content?.trim() || '';
      showStatus(`OpenAI is working! Response: "${reply}"`, 'success');
    } else if (response.status === 401) {
      showStatus('Invalid API key. Please check your key.', 'error');
    } else if (response.status === 429) {
      showStatus('Rate limit or quota exceeded. Check your OpenAI account.', 'error');
    } else if (response.status === 402) {
      showStatus('Insufficient credits. Add credits to your OpenAI account.', 'error');
    } else {
      const errorData = await response.json().catch(() => ({}));
      showStatus(`Error: ${errorData.error?.message || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    showStatus('Cannot connect to OpenAI API: ' + error.message, 'error');
  }
}

// Translate entire page
document.getElementById('translatePageBtn').addEventListener('click', async () => {
  const btn = document.getElementById('translatePageBtn');
  btn.disabled = true;
  btn.textContent = 'Translating...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if this is a restricted page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot translate browser pages');
    }

    await chrome.tabs.sendMessage(tab.id, { action: 'translatePage' });
    showStatus('Page translation started', 'success');
  } catch (error) {
    if (error.message.includes('Receiving end does not exist')) {
      showStatus('Please reload the extension, then refresh this page', 'error');
    } else {
      showStatus('Failed: ' + error.message, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Translate Page';
  }
});

// Show original text (revert all translations)
document.getElementById('revertAllBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.tabs.sendMessage(tab.id, { action: 'revertAll' });
    showStatus('Showing original text', 'success');
  } catch (error) {
    if (error.message.includes('Receiving end does not exist')) {
      showStatus('No translations on page', 'success');
    } else {
      showStatus('Failed: ' + error.message, 'error');
    }
  }
});
