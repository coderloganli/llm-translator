// Store original text and translation state for each element
const translationState = new WeakMap();

let translateButton = null;
let currentSelection = null;
let currentRange = null;
let hoveredTranslatedSpan = null;
let hideButtonTimer = null;

// Create the translate button
function createTranslateButton() {
  const button = document.createElement('div');
  button.id = 'local-translator-button';
  button.innerHTML = '🌐 Translate';
  button.style.display = 'none';
  document.body.appendChild(button);

  button.addEventListener('click', handleTranslateClick);

  // Keep button visible while mouse is over it
  button.addEventListener('mouseenter', () => {
    if (hideButtonTimer) {
      clearTimeout(hideButtonTimer);
      hideButtonTimer = null;
    }
  });

  // Start hide timer when mouse leaves button
  button.addEventListener('mouseleave', () => {
    hideButtonTimer = setTimeout(() => {
      hideButton();
      hoveredTranslatedSpan = null;
    }, 1000);
  });

  return button;
}

// Position the button near the selection
function positionButton(x, y) {
  if (!translateButton) {
    translateButton = createTranslateButton();
  }

  translateButton.style.left = `${x}px`;
  translateButton.style.top = `${y}px`;
  translateButton.style.display = 'block';
}

// Hide the button
function hideButton() {
  if (translateButton) {
    translateButton.style.display = 'none';
  }
}

// Handle text selection
document.addEventListener('mouseup', (e) => {
  // Don't trigger if clicking on the button itself
  if (e.target.id === 'local-translator-button') {
    return;
  }

  // Don't trigger text selection logic when clicking on translated/translating spans
  if (e.target?.classList?.contains('local-translator-translated') ||
      e.target?.classList?.contains('local-translator-translating')) {
    return;
  }

  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0) {
      currentSelection = selectedText;
      currentRange = selection.getRangeAt(0).cloneRange();

      // Check if this text has been translated before
      const container = currentRange.commonAncestorContainer;
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      const state = translationState.get(element);

      if (state && state.isTranslated) {
        translateButton.innerHTML = '↩️ Revert';
      } else {
        translateButton.innerHTML = '🌐 Translate';
      }

      // Position button near the selection
      const rect = currentRange.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      positionButton(rect.right + scrollX + 5, rect.top + scrollY - 5);
    } else {
      hideButton();
    }
  }, 10);
});

// Hide button when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  if (e.target?.id !== 'local-translator-button' &&
      !e.target?.classList?.contains('local-translator-translated') &&
      !e.target?.classList?.contains('local-translator-translating')) {
    hideButton();
    hoveredTranslatedSpan = null;
    if (hideButtonTimer) {
      clearTimeout(hideButtonTimer);
      hideButtonTimer = null;
    }
  }
});

// Handle mouse enter on translated text spans
document.addEventListener('mouseenter', (e) => {
  if (e.target?.classList?.contains('local-translator-translated')) {
    // Clear any pending hide timer
    if (hideButtonTimer) {
      clearTimeout(hideButtonTimer);
      hideButtonTimer = null;
    }

    hoveredTranslatedSpan = e.target;

    // Position and show button next to the hovered span
    const rect = e.target.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Show appropriate button based on current state
    if (e.target.dataset.showing === 'translated') {
      translateButton.innerHTML = '↩️ Revert';
    } else {
      translateButton.innerHTML = '🌐 Translate';
    }
    positionButton(rect.right + scrollX + 5, rect.top + scrollY - 5);
  }
}, true);

// Handle mouse leave on translated text spans
document.addEventListener('mouseleave', (e) => {
  if (e.target?.classList?.contains('local-translator-translated')) {
    // Delay hiding the button by 1 second
    hideButtonTimer = setTimeout(() => {
      if (hoveredTranslatedSpan === e.target) {
        hideButton();
        hoveredTranslatedSpan = null;
      }
    }, 1000);
  }
}, true);

// Handle translate button click
async function handleTranslateClick(e) {
  e.preventDefault();
  e.stopPropagation();

  // Handle hover-to-toggle case (when mouse was over a translated span)
  if (hoveredTranslatedSpan) {
    toggleTranslationOnSpan(hoveredTranslatedSpan);
    hoveredTranslatedSpan = null;
    return;
  }

  if (!currentRange || !currentSelection) {
    return;
  }

  const container = currentRange.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  const state = translationState.get(element);

  // If already translated, revert to original
  if (state && state.isTranslated) {
    revertTranslation(element, state);
    return;
  }

  // Capture current selection/range before async operation (prevents race condition)
  const capturedRange = currentRange.cloneRange();

  // Split selection into paragraphs
  const paragraphs = splitRangeIntoParagraphs(capturedRange);

  hideButton();

  // Get settings from storage
  const settings = await chrome.storage.sync.get({
    targetLanguage: 'Chinese',
    modelName: 'llama3.2'
  });

  // Create all translating spans immediately (so user sees them all turn orange)
  const translatingSpans = [];
  for (const para of paragraphs) {
    const span = createTranslatingSpan(para.range, para.text);
    translatingSpans.push({ span, text: para.text });
  }

  // Translate each paragraph in order (top to bottom)
  for (const item of translatingSpans) {
    await translateSpan(item.span, item.text, settings);
  }
}

// Split a range into separate paragraph ranges
function splitRangeIntoParagraphs(range) {
  const paragraphs = [];
  const container = range.commonAncestorContainer;

  // If selection is within a single text node or simple element, treat as single paragraph
  if (container.nodeType === Node.TEXT_NODE ||
      !containsBlockElement(range)) {
    return [{
      range: range.cloneRange(),
      text: range.toString().trim()
    }];
  }

  // Walk through the range and split by block elements
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
            range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  let currentParagraph = null;
  let currentBlock = null;
  let node;

  while ((node = walker.nextNode())) {
    const block = getBlockParent(node);
    const text = getTextInRange(node, range);

    if (!text.trim()) continue;

    if (block !== currentBlock) {
      // New paragraph
      if (currentParagraph && currentParagraph.text.trim()) {
        paragraphs.push(currentParagraph);
      }
      currentBlock = block;
      currentParagraph = {
        range: createRangeForTextNode(node, range),
        text: text
      };
    } else {
      // Same paragraph, extend range and append text
      if (currentParagraph) {
        extendRange(currentParagraph.range, node, range);
        currentParagraph.text += text;
      }
    }
  }

  // Add last paragraph
  if (currentParagraph && currentParagraph.text.trim()) {
    paragraphs.push(currentParagraph);
  }

  // If no paragraphs found, fall back to treating entire range as one
  if (paragraphs.length === 0) {
    return [{
      range: range.cloneRange(),
      text: range.toString().trim()
    }];
  }

  return paragraphs;
}

// Check if a range contains any block-level elements
function containsBlockElement(range) {
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  const blockTags = ['P', 'DIV', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'ARTICLE', 'SECTION'];

  for (const tag of blockTags) {
    if (element.getElementsByTagName(tag).length > 0) {
      return true;
    }
  }

  // Also check if the container itself is a block that contains multiple block children
  if (element.children.length > 1) {
    let blockCount = 0;
    for (const child of element.children) {
      if (blockTags.includes(child.tagName) ||
          window.getComputedStyle(child).display === 'block') {
        blockCount++;
      }
    }
    if (blockCount > 1) return true;
  }

  return false;
}

// Get the nearest block-level parent of a node
function getBlockParent(node) {
  const blockTags = ['P', 'DIV', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TD', 'TH', 'ARTICLE', 'SECTION', 'BODY'];
  let current = node.parentElement;

  while (current) {
    if (blockTags.includes(current.tagName) ||
        window.getComputedStyle(current).display === 'block') {
      return current;
    }
    current = current.parentElement;
  }

  return document.body;
}

// Get the portion of text node that's within the selection range
function getTextInRange(textNode, range) {
  const nodeRange = document.createRange();
  nodeRange.selectNode(textNode);

  let start = 0;
  let end = textNode.textContent.length;

  if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) {
    start = range.startOffset;
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) < 0) {
    end = range.endOffset;
  }

  // Handle case where range boundaries are not in this node
  if (textNode === range.startContainer) {
    start = range.startOffset;
  }
  if (textNode === range.endContainer) {
    end = range.endOffset;
  }

  return textNode.textContent.substring(start, end);
}

// Create a range for a single text node within the selection
function createRangeForTextNode(textNode, selectionRange) {
  const nodeRange = document.createRange();

  let start = 0;
  let end = textNode.textContent.length;

  if (textNode === selectionRange.startContainer) {
    start = selectionRange.startOffset;
  }
  if (textNode === selectionRange.endContainer) {
    end = selectionRange.endOffset;
  }

  nodeRange.setStart(textNode, start);
  nodeRange.setEnd(textNode, end);

  return nodeRange;
}

// Extend a range to include another text node
function extendRange(range, textNode, selectionRange) {
  let end = textNode.textContent.length;

  if (textNode === selectionRange.endContainer) {
    end = selectionRange.endOffset;
  }

  range.setEnd(textNode, end);
}

// Translate a single span (already created)
async function translateSpan(span, text, settings) {
  if (!text.trim() || !span || !span.parentNode) return;

  try {
    // Send message to background script for translation
    const response = await chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      targetLanguage: settings.targetLanguage,
      modelName: settings.modelName
    });

    if (response.success) {
      // Update the translating span to translated state
      finishTranslation(span, text, response.translatedText);
    } else {
      // Revert on failure
      revertTranslatingSpan(span, text);
      console.error('Translation failed: ' + response.error);
    }
  } catch (error) {
    console.error('Translation error:', error);
    revertTranslatingSpan(span, text);
  }
}

// Create a span to indicate translation in progress
function createTranslatingSpan(range, originalText) {
  const selection = window.getSelection();
  selection.removeAllRanges();

  const span = document.createElement('span');
  span.className = 'local-translator-translating';
  span.dataset.originalText = originalText;

  // Extract contents preserving HTML structure (including links)
  const contents = range.extractContents();
  span.appendChild(contents);

  // Store original HTML for later restoration
  span.dataset.originalHtml = span.innerHTML;

  range.insertNode(span);

  selection.removeAllRanges();
  return span;
}

// Convert translating span to translated span
function finishTranslation(span, originalText, translatedText) {
  if (!span || !span.parentNode) return;

  span.className = 'local-translator-translated';
  span.dataset.originalText = originalText;
  span.dataset.translatedText = translatedText;
  span.dataset.showing = 'translated';

  // Preserve originalHtml if not already set (from createTranslatingSpan)
  if (!span.dataset.originalHtml) {
    span.dataset.originalHtml = span.innerHTML;
  }

  // Show translated text (plain text, links not applicable to translation)
  span.textContent = translatedText;
}

// Revert translating span back to original content (on failure)
function revertTranslatingSpan(span, originalText) {
  if (!span || !span.parentNode) return;

  // Restore original HTML structure if available
  if (span.dataset.originalHtml) {
    const template = document.createElement('template');
    template.innerHTML = span.dataset.originalHtml;
    const fragment = template.content;
    span.parentNode.replaceChild(fragment, span);
  } else {
    const textNode = document.createTextNode(originalText);
    span.parentNode.replaceChild(textNode, span);
  }
}

// Replace selected text with new text
function replaceSelectedText(newText) {
  if (!currentRange) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(currentRange);

  // Create a span to hold the translated text (for easier revert/toggle)
  const span = document.createElement('span');
  span.className = 'local-translator-translated';
  span.textContent = newText;
  span.dataset.originalText = currentSelection;
  span.dataset.translatedText = newText;
  span.dataset.showing = 'translated';

  currentRange.deleteContents();
  currentRange.insertNode(span);

  // Store reference to the span
  const container = currentRange.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  const state = translationState.get(element);
  if (state) {
    state.translatedSpan = span;
  }

  selection.removeAllRanges();
}

// Revert translation to original text (using WeakMap state)
function revertTranslation(element, state) {
  if (state.translatedSpan && state.translatedSpan.parentNode) {
    const textNode = document.createTextNode(state.originalText);
    state.translatedSpan.parentNode.replaceChild(textNode, state.translatedSpan);
  }

  state.isTranslated = false;
  translateButton.innerHTML = '🌐 Translate';
  hideButton();
}

// Toggle translation on span (swap between original and translated text)
function toggleTranslationOnSpan(span) {
  if (!span) return;

  if (span.dataset.showing === 'translated') {
    // Switch to original - restore HTML structure (preserves links)
    if (span.dataset.originalHtml) {
      span.innerHTML = span.dataset.originalHtml;
    } else {
      span.textContent = span.dataset.originalText;
    }
    span.dataset.showing = 'original';
    translateButton.innerHTML = '🌐 Translate';
  } else {
    // Switch to translated (plain text)
    span.textContent = span.dataset.translatedText;
    span.dataset.showing = 'translated';
    translateButton.innerHTML = '↩️ Revert';
  }
  hideButton();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true });
  } else if (request.action === 'translatePage') {
    translateWholePage();
    sendResponse({ success: true });
  } else if (request.action === 'revertAll') {
    revertAllTranslations();
    sendResponse({ success: true });
  } else if (request.action === 'showTranslations') {
    showAllTranslations();
    sendResponse({ success: true });
  } else if (request.action === 'removeTranslations') {
    removeAllTranslations();
    sendResponse({ success: true });
  }
  return true;
});

// Translate the entire page
async function translateWholePage() {
  // First check if there are cached translations - if so, just show them
  const existingTranslations = document.querySelectorAll('.local-translator-translated');
  if (existingTranslations.length > 0) {
    // Show cached translations without LLM request
    showAllTranslations();
    return;
  }

  // Get settings
  const settings = await chrome.storage.sync.get({
    targetLanguage: 'Chinese',
    modelName: 'llama3.2'
  });

  // Find all text nodes that should be translated
  const textNodes = getTranslatableTextNodes();

  // Group text nodes by their block parent for paragraph-level translation
  const paragraphs = groupTextNodesByBlock(textNodes);

  // Create translating spans for all paragraphs at once (visual feedback)
  const translatingItems = [];
  for (const para of paragraphs) {
    if (para.text.trim().length < 2) continue; // Skip very short text

    const span = wrapTextNodesInSpan(para.nodes, para.text);
    if (span) {
      translatingItems.push({ span, text: para.text });
    }
  }

  // Translate each paragraph sequentially
  for (const item of translatingItems) {
    await translateSpan(item.span, item.text, settings);
  }
}

// Get all text nodes that should be translated
function getTranslatableTextNodes() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip empty or whitespace-only nodes
        if (!node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip nodes in script, style, noscript, etc.
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tagName = parent.tagName.toUpperCase();
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'];
        if (skipTags.includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip already translated/translating spans
        if (parent.classList.contains('local-translator-translated') ||
            parent.classList.contains('local-translator-translating')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip our own button
        if (parent.id === 'local-translator-button') {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  return textNodes;
}

// Group text nodes by their block-level parent
function groupTextNodesByBlock(textNodes) {
  const groups = new Map();

  for (const node of textNodes) {
    const block = getBlockParent(node);
    if (!groups.has(block)) {
      groups.set(block, { nodes: [], text: '' });
    }
    const group = groups.get(block);
    group.nodes.push(node);
    group.text += node.textContent;
  }

  return Array.from(groups.values());
}

// Wrap multiple text nodes in a translating span
function wrapTextNodesInSpan(nodes, originalText) {
  if (nodes.length === 0) return null;

  // For single text node, check if parent has other content (like links)
  if (nodes.length === 1) {
    const node = nodes[0];
    const parent = node.parentElement;

    // If parent is an inline element with just this text, wrap the parent's content
    if (parent && parent.childNodes.length > 1) {
      // Parent has multiple children (text + links etc), wrap them all
      const range = document.createRange();
      range.selectNodeContents(parent);

      const span = document.createElement('span');
      span.className = 'local-translator-translating';
      span.dataset.originalText = originalText;

      const contents = range.extractContents();
      span.appendChild(contents);
      span.dataset.originalHtml = span.innerHTML;

      parent.appendChild(span);
      return span;
    }

    // Simple single text node case
    const span = document.createElement('span');
    span.className = 'local-translator-translating';
    span.dataset.originalText = node.textContent;
    span.dataset.originalHtml = node.textContent;
    span.textContent = node.textContent;
    node.parentNode.replaceChild(span, node);
    return span;
  }

  // For multiple nodes in same block, wrap the entire range
  const range = document.createRange();
  range.setStartBefore(nodes[0]);
  range.setEndAfter(nodes[nodes.length - 1]);

  const span = document.createElement('span');
  span.className = 'local-translator-translating';
  span.dataset.originalText = originalText;

  try {
    // Extract contents to preserve HTML structure
    const contents = range.extractContents();
    span.appendChild(contents);
    span.dataset.originalHtml = span.innerHTML;
    range.insertNode(span);
    return span;
  } catch (e) {
    // If extraction fails, try surroundContents
    try {
      range.surroundContents(span);
      span.dataset.originalHtml = span.innerHTML;
      return span;
    } catch (e2) {
      // Last resort: fall back to replacing with text (loses HTML)
      const firstNode = nodes[0];
      const fallbackSpan = document.createElement('span');
      fallbackSpan.className = 'local-translator-translating';
      fallbackSpan.textContent = originalText;
      fallbackSpan.dataset.originalText = originalText;
      fallbackSpan.dataset.originalHtml = originalText;
      firstNode.parentNode.replaceChild(fallbackSpan, firstNode);

      // Remove other nodes
      for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].parentNode) {
          nodes[i].parentNode.removeChild(nodes[i]);
        }
      }

      return fallbackSpan;
    }
  }
}

// Revert all translations on the page (toggle to original, keep spans for caching)
function revertAllTranslations() {
  const translatedSpans = document.querySelectorAll('.local-translator-translated');

  for (const span of translatedSpans) {
    if (span.dataset.showing === 'translated') {
      // Restore original HTML structure (preserves links)
      if (span.dataset.originalHtml) {
        span.innerHTML = span.dataset.originalHtml;
      } else if (span.dataset.originalText) {
        span.textContent = span.dataset.originalText;
      }
      span.dataset.showing = 'original';
    }
  }

  hideButton();
}

// Show all translations (toggle to translated text)
function showAllTranslations() {
  const translatedSpans = document.querySelectorAll('.local-translator-translated');

  for (const span of translatedSpans) {
    if (span.dataset.showing === 'original' && span.dataset.translatedText) {
      span.textContent = span.dataset.translatedText;
      span.dataset.showing = 'translated';
    }
  }

  hideButton();
}

// Remove all translations completely (destroy cache)
function removeAllTranslations() {
  const translatedSpans = document.querySelectorAll('.local-translator-translated, .local-translator-translating');

  for (const span of translatedSpans) {
    // Restore original HTML structure (preserves links)
    if (span.dataset.originalHtml) {
      // Create a temporary container to parse the HTML
      const template = document.createElement('template');
      template.innerHTML = span.dataset.originalHtml;
      const fragment = template.content;

      // Replace span with its original contents
      span.parentNode.replaceChild(fragment, span);
    } else if (span.dataset.originalText) {
      const textNode = document.createTextNode(span.dataset.originalText);
      span.parentNode.replaceChild(textNode, span);
    }
  }

  hideButton();
}

// Initialize
if (!translateButton) {
  translateButton = createTranslateButton();
}
