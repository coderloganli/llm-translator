// Background service worker for handling translation API requests

// Default settings
const defaults = {
  provider: 'ollama',
  targetLanguage: 'Chinese',
  modelName: 'llama3.2',
  ollamaUrl: 'http://localhost:11434',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini'
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Handle translation request
async function handleTranslation({ text, targetLanguage, modelName }) {
  try {
    const settings = await chrome.storage.sync.get(defaults);

    if (settings.provider === 'openai') {
      return await translateWithOpenAI(text, targetLanguage, settings);
    } else {
      return await translateWithOllama(text, targetLanguage, modelName, settings);
    }
  } catch (error) {
    console.error('Translation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Translate using Ollama (local)
async function translateWithOllama(text, targetLanguage, modelName, settings) {
  try {
    const ollamaUrl = settings.ollamaUrl || defaults.ollamaUrl;

    const prompt = `Translate the following text to ${targetLanguage}. Only output the translation, nothing else. Do not add any explanations or notes.

Text to translate:
${text}

Translation:`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let translatedText = data.response.trim();

    // Clean up the response - remove quotes if present
    if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
        (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
      translatedText = translatedText.slice(1, -1);
    }

    return {
      success: true,
      translatedText: translatedText
    };
  } catch (error) {
    console.error('Ollama translation error:', error);

    // Provide helpful error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        success: false,
        error: 'Cannot connect to Ollama. Make sure Ollama is running on your machine.'
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

// Translate using OpenAI API
async function translateWithOpenAI(text, targetLanguage, settings) {
  try {
    const apiKey = settings.openaiApiKey;
    const model = settings.openaiModel || defaults.openaiModel;

    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured. Please set it in the extension settings.'
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the user's text to ${targetLanguage}. Only output the translation, nothing else. Do not add any explanations, notes, or quotation marks.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (response.status === 402) {
        throw new Error('Insufficient credits. Please add credits to your OpenAI account.');
      } else {
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
    }

    const data = await response.json();
    let translatedText = data.choices[0].message.content.trim();

    // Clean up the response - remove quotes if present
    if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
        (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
      translatedText = translatedText.slice(1, -1);
    }

    return {
      success: true,
      translatedText: translatedText
    };
  } catch (error) {
    console.error('OpenAI translation error:', error);

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        success: false,
        error: 'Cannot connect to OpenAI API. Please check your internet connection.'
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}
