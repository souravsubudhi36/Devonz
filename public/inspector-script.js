(function () {
  // Inject scrollbar styling to match parent app theme
  (function injectScrollbarStyles() {
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(100, 100, 100, 0.6); }
      html { scrollbar-width: thin; scrollbar-color: rgba(100, 100, 100, 0.4) transparent; }
    `;
    (document.head || document.documentElement).appendChild(style);
  })();

  let isInspectorActive = false;
  let inspectorStyle = null;
  let currentHighlight = null;
  let selectedElement = null; // Track the currently selected element for editing
  let originalStyles = {}; // Store original styles for revert functionality
  let originalText = ''; // Store original text content for revert
  let resizeHandles = null; // Container for resize handles
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let resizeHandle = null;
  let bulkOriginalStyles = new Map(); // Store original styles for bulk revert

  // ============================================================
  // Console Error Capture for Auto-Fix Integration
  // ============================================================

  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Debounce mechanism to prevent flooding
  let lastErrorTime = 0;
  const ERROR_DEBOUNCE_MS = 1000;
  const recentErrorHashes = new Set();

  function hashString(str) {
    let hash = 0;
    const normalized = String(str).replace(/\d+/g, 'N').slice(0, 200);
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  function shouldForwardError(message) {
    const now = Date.now();
    const errorHash = hashString(message);

    // Skip if same error was sent recently
    if (recentErrorHashes.has(errorHash)) {
      return false;
    }

    // Skip if too soon after last error
    if (now - lastErrorTime < ERROR_DEBOUNCE_MS) {
      return false;
    }

    // Track this error
    recentErrorHashes.add(errorHash);
    lastErrorTime = now;

    // Clear old hashes after 30 seconds
    setTimeout(() => recentErrorHashes.delete(errorHash), 30000);

    return true;
  }

  function isAutoFixableError(message) {
    const autoFixPatterns = [
      /SyntaxError/i,
      /TypeError/i,
      /ReferenceError/i,
      /does not provide an export named/i,
      /Cannot find module/i,
      /Module not found/i,
      /Failed to resolve import/i,
      /\[hmr\].*failed.*reload/i,
      /Unexpected token/i,
      /is not defined/i,
      /is not a function/i,
    ];
    return autoFixPatterns.some((pattern) => pattern.test(message));
  }

  function forwardErrorToParent(type, message, stack) {
    const fullMessage = String(message);

    if (!shouldForwardError(fullMessage)) {
      return;
    }

    // Only forward errors that are likely to be fixable by the AI
    if (!isAutoFixableError(fullMessage)) {
      return;
    }

    try {
      window.parent.postMessage(
        {
          type: 'PREVIEW_CONSOLE_ERROR',
          errorType: type,
          message: fullMessage,
          stack: stack || '',
          url: window.location.href,
          timestamp: Date.now(),
        },
        '*',
      );
    } catch (e) {
      // Silently fail if postMessage fails
    }
  }

  // Override console.error to capture errors
  console.error = function (...args) {
    originalConsoleError.apply(console, args);

    const message = args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message + (arg.stack ? '\n' + arg.stack : '');
        }
        return String(arg);
      })
      .join(' ');

    forwardErrorToParent('console.error', message);
  };

  // Capture global errors (synchronous)
  window.addEventListener('error', function (event) {
    const message = event.message || 'Unknown error';
    const stack = event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`;
    forwardErrorToParent('error', message, stack);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let stack = '';

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack || '';
    } else if (typeof reason === 'string') {
      message = reason;
    } else if (reason) {
      message = String(reason);
    }

    forwardErrorToParent('unhandledrejection', message, stack);
  });

  // ============================================================
  // End Console Error Capture
  // ============================================================

  // ============================================================
  // Vite Error Overlay Detection
  // ============================================================
  // Vite displays errors (including ES module errors) in a custom element
  // called <vite-error-overlay>. We observe the DOM for this element and
  // extract error info from its shadow DOM.

  function extractViteOverlayError(overlay) {
    try {
      const shadowRoot = overlay.shadowRoot;
      if (!shadowRoot) {
        console.log('[Preview] vite-error-overlay has no shadowRoot');
        return null;
      }

      const messageBody = shadowRoot.querySelector('.message-body');
      const fileEl = shadowRoot.querySelector('.file');
      const stackEl = shadowRoot.querySelector('.stack');

      const message = messageBody?.textContent?.trim() || 'Unknown Vite error';
      const file = fileEl?.textContent?.trim() || '';
      const stack = stackEl?.textContent?.trim() || '';

      // Combine into full error message
      const fullMessage = [message, file ? `File: ${file}` : '', stack].filter(Boolean).join('\n');

      return {
        message: message,
        fullMessage: fullMessage,
        file: file,
        stack: stack,
      };
    } catch (e) {
      console.log('[Preview] Error extracting vite overlay:', e);
      return null;
    }
  }

  function forwardViteOverlayError(errorInfo) {
    if (!errorInfo || !shouldForwardError(errorInfo.message)) {
      return;
    }

    console.log('[Preview] Detected Vite error overlay:', errorInfo.message);

    try {
      window.parent.postMessage(
        {
          type: 'PREVIEW_VITE_ERROR',
          errorType: 'vite-overlay',
          message: errorInfo.message,
          fullMessage: errorInfo.fullMessage,
          file: errorInfo.file,
          stack: errorInfo.stack,
          url: window.location.href,
          timestamp: Date.now(),
        },
        '*',
      );
    } catch (e) {
      // Silently fail if postMessage fails
    }
  }

  // Set up MutationObserver to watch for vite-error-overlay
  function setupViteOverlayObserver() {
    // Check if vite-error-overlay already exists
    const existingOverlay = document.querySelector('vite-error-overlay');
    if (existingOverlay) {
      const errorInfo = extractViteOverlayError(existingOverlay);
      if (errorInfo) {
        forwardViteOverlayError(errorInfo);
      }
    }

    // Observe for new overlays being added
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeName && node.nodeName.toLowerCase() === 'vite-error-overlay') {
            // Give the shadow DOM a moment to populate
            setTimeout(() => {
              const errorInfo = extractViteOverlayError(node);
              if (errorInfo) {
                forwardViteOverlayError(errorInfo);
              }
            }, 100);
          }
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: false, // Only watch direct children of body
    });

    console.log('[Preview] Vite error overlay observer initialized');
  }

  // Initialize vite overlay observer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupViteOverlayObserver);
  } else {
    setupViteOverlayObserver();
  }

  // ============================================================
  // End Vite Error Overlay Detection
  // ============================================================

  // ============================================================
  // Screenshot Capture for Version Thumbnails
  // ============================================================
  // Uses html2canvas to capture the page and send it back to parent

  let html2canvasLoaded = false;
  let html2canvasLoading = false;
  const html2canvasLoadCallbacks = [];

  function loadHtml2Canvas(callback) {
    if (html2canvasLoaded && window.html2canvas) {
      callback(window.html2canvas);
      return;
    }

    html2canvasLoadCallbacks.push(callback);

    if (html2canvasLoading) {
      return;
    }

    html2canvasLoading = true;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    script.onload = function () {
      html2canvasLoaded = true;
      html2canvasLoading = false;
      console.log('[Preview] html2canvas loaded successfully');

      while (html2canvasLoadCallbacks.length > 0) {
        const cb = html2canvasLoadCallbacks.shift();
        cb(window.html2canvas);
      }
    };
    script.onerror = function () {
      html2canvasLoading = false;
      console.error('[Preview] Failed to load html2canvas');

      while (html2canvasLoadCallbacks.length > 0) {
        const cb = html2canvasLoadCallbacks.shift();
        cb(null);
      }
    };
    document.head.appendChild(script);
  }

  async function captureScreenshot(requestId, options = {}) {
    const width = options.width || 320;
    const height = options.height || 200;

    loadHtml2Canvas(async function (html2canvas) {
      if (!html2canvas) {
        // Send fallback placeholder
        sendScreenshotResponse(requestId, generatePlaceholderScreenshot(width, height), true);
        return;
      }

      try {
        // Capture the full page
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#0d1117',
          scale: 0.5, // Lower scale for smaller file size
          logging: false,
          width: window.innerWidth,
          height: window.innerHeight,
        });

        // Resize to thumbnail size
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = width;
        thumbCanvas.height = height;
        const ctx = thumbCanvas.getContext('2d');

        if (ctx) {
          // Calculate aspect ratio crop
          const srcRatio = canvas.width / canvas.height;
          const destRatio = width / height;

          let srcX = 0,
            srcY = 0,
            srcW = canvas.width,
            srcH = canvas.height;

          if (srcRatio > destRatio) {
            // Source is wider - crop sides
            srcW = canvas.height * destRatio;
            srcX = (canvas.width - srcW) / 2;
          } else {
            // Source is taller - crop bottom
            srcH = canvas.width / destRatio;
          }

          ctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, width, height);

          const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
          sendScreenshotResponse(requestId, dataUrl, false);
        } else {
          sendScreenshotResponse(requestId, generatePlaceholderScreenshot(width, height), true);
        }
      } catch (error) {
        console.error('[Preview] Screenshot capture failed:', error);
        sendScreenshotResponse(requestId, generatePlaceholderScreenshot(width, height), true);
      }
    });
  }

  function generatePlaceholderScreenshot(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    // Dark background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1f2e');
    bgGradient.addColorStop(1, '#0f1219');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Browser chrome mockup - top bar
    ctx.fillStyle = '#252a38';
    ctx.fillRect(0, 0, width, 28);

    // Traffic lights
    ctx.fillStyle = '#ff5f57';
    ctx.beginPath();
    ctx.arc(12, 14, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#febc2e';
    ctx.beginPath();
    ctx.arc(28, 14, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#28c840';
    ctx.beginPath();
    ctx.arc(44, 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // URL bar
    ctx.fillStyle = '#1a1f2e';
    ctx.beginPath();
    ctx.roundRect(60, 6, width - 70, 16, 4);
    ctx.fill();

    // Content mockup
    const contentY = 38;
    ctx.fillStyle = '#2d3548';
    ctx.fillRect(0, contentY, width, 32);

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(10, contentY + 8, 60, 16, 3);
    ctx.fill();

    // Text lines
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(20, contentY + 50, width * 0.6, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(20, contentY + 78, width * 0.45, 12);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    return canvas.toDataURL('image/png', 0.8);
  }

  function sendScreenshotResponse(requestId, dataUrl, isPlaceholder) {
    try {
      window.parent.postMessage(
        {
          type: 'PREVIEW_SCREENSHOT_RESPONSE',
          requestId: requestId,
          dataUrl: dataUrl,
          isPlaceholder: isPlaceholder,
          timestamp: Date.now(),
        },
        '*',
      );
      console.log('[Preview] Screenshot sent, size:', Math.round(dataUrl.length / 1024), 'KB');
    } catch (e) {
      console.error('[Preview] Failed to send screenshot:', e);
    }
  }

  // Listen for screenshot requests from parent
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'CAPTURE_SCREENSHOT_REQUEST') {
      console.log('[Preview] Screenshot request received:', event.data.requestId);
      captureScreenshot(event.data.requestId, event.data.options || {});
    }
  });

  console.log('[Preview] Screenshot capture handler initialized');

  // ============================================================
  // End Screenshot Capture
  // ============================================================

  // Function to get relevant styles
  function getRelevantStyles(element) {
    const computedStyles = window.getComputedStyle(element);
    const relevantProps = [
      'display',
      'position',
      'width',
      'height',
      'margin',
      'padding',
      'border',
      'background',
      'background-color',
      'color',
      'font-size',
      'font-weight',
      'font-family',
      'text-align',
      'flex-direction',
      'justify-content',
      'align-items',
      'gap',
      'border-radius',
      'box-shadow',
      'opacity',
      'overflow',
    ];

    const styles = {};
    relevantProps.forEach((prop) => {
      const value = computedStyles.getPropertyValue(prop);
      if (value) styles[prop] = value;
    });

    return styles;
  }

  // Function to extract detailed box model values
  function getBoxModel(element) {
    const computedStyles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    // Helper function to parse CSS value to number (removes 'px', etc.)
    function parseValue(value) {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }

    // Get width and height - use computed styles, fallback to bounding rect
    const computedWidth = computedStyles.getPropertyValue('width');
    const computedHeight = computedStyles.getPropertyValue('height');
    const width = computedWidth === 'auto' ? rect.width : parseValue(computedWidth);
    const height = computedHeight === 'auto' ? rect.height : parseValue(computedHeight);

    return {
      margin: {
        top: parseValue(computedStyles.getPropertyValue('margin-top')),
        right: parseValue(computedStyles.getPropertyValue('margin-right')),
        bottom: parseValue(computedStyles.getPropertyValue('margin-bottom')),
        left: parseValue(computedStyles.getPropertyValue('margin-left')),
      },
      padding: {
        top: parseValue(computedStyles.getPropertyValue('padding-top')),
        right: parseValue(computedStyles.getPropertyValue('padding-right')),
        bottom: parseValue(computedStyles.getPropertyValue('padding-bottom')),
        left: parseValue(computedStyles.getPropertyValue('padding-left')),
      },
      border: {
        top: parseValue(computedStyles.getPropertyValue('border-top-width')),
        right: parseValue(computedStyles.getPropertyValue('border-right-width')),
        bottom: parseValue(computedStyles.getPropertyValue('border-bottom-width')),
        left: parseValue(computedStyles.getPropertyValue('border-left-width')),
      },
      borderColor: computedStyles.getPropertyValue('border-color'),
      borderStyle: computedStyles.getPropertyValue('border-style'),
      width: width,
      height: height,
      boxSizing: computedStyles.getPropertyValue('box-sizing'),
    };
  }

  // Function to create a readable element selector
  function createReadableSelector(element) {
    let selector = element.tagName.toLowerCase();

    // Add ID if present
    if (element.id) {
      selector += `#${element.id}`;
    }

    // Add classes if present
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }

      if (className.trim()) {
        const classes = className.trim().split(/\s+/).slice(0, 3); // Limit to first 3 classes
        selector += `.${classes.join('.')}`;
      }
    }

    return selector;
  }

  // Function to create element display text
  function createElementDisplayText(element) {
    const tagName = element.tagName.toLowerCase();
    let displayText = `<${tagName}`;

    // Add ID attribute
    if (element.id) {
      displayText += ` id="${element.id}"`;
    }

    // Add class attribute (limit to first 3 classes for readability)
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }

      if (className.trim()) {
        const classes = className.trim().split(/\s+/);
        const displayClasses = classes.length > 3 ? classes.slice(0, 3).join(' ') + '...' : classes.join(' ');
        displayText += ` class="${displayClasses}"`;
      }
    }

    // Add other important attributes
    const importantAttrs = ['type', 'name', 'href', 'src', 'alt', 'title'];
    importantAttrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) {
        const truncatedValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
        displayText += ` ${attr}="${truncatedValue}"`;
      }
    });

    displayText += '>';

    // Add text content preview for certain elements
    const textElements = ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'label'];
    if (textElements.includes(tagName) && element.textContent) {
      const textPreview = element.textContent.trim().substring(0, 50);
      if (textPreview) {
        displayText += textPreview.length < element.textContent.trim().length ? textPreview + '...' : textPreview;
      }
    }

    displayText += `</${tagName}>`;

    return displayText;
  }

  // Function to extract colors from element and its children
  function extractElementColors(element) {
    const colors = new Set();
    const colorProps = ['color', 'background-color', 'border-color', 'outline-color'];

    // Get colors from current element
    const computedStyles = window.getComputedStyle(element);
    colorProps.forEach((prop) => {
      const value = computedStyles.getPropertyValue(prop);
      if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
        colors.add(value);
      }
    });

    // Get colors from children (limit depth for performance)
    const collectColors = (el, depth = 0) => {
      if (depth > 3) return; // Limit recursion depth

      const styles = window.getComputedStyle(el);
      colorProps.forEach((prop) => {
        const value = styles.getPropertyValue(prop);
        if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
          colors.add(value);
        }
      });

      // Recurse into children
      Array.from(el.children)
        .slice(0, 10)
        .forEach((child) => {
          collectColors(child, depth + 1);
        });
    };

    // Collect from children
    Array.from(element.children)
      .slice(0, 10)
      .forEach((child) => {
        collectColors(child, 1);
      });

    // Also look at parent for context colors
    if (element.parentElement) {
      const parentStyles = window.getComputedStyle(element.parentElement);
      colorProps.forEach((prop) => {
        const value = parentStyles.getPropertyValue(prop);
        if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
          colors.add(value);
        }
      });
    }

    return Array.from(colors).slice(0, 16); // Limit to 16 colors
  }

  // Function to create element info
  function createElementInfo(element) {
    const rect = element.getBoundingClientRect();

    return {
      tagName: element.tagName,
      className: getElementClassName(element),
      id: element.id || '',
      textContent: element.textContent?.slice(0, 100) || '',
      styles: getRelevantStyles(element),
      boxModel: getBoxModel(element),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      },
      // Add new readable formats
      selector: createReadableSelector(element),
      displayText: createElementDisplayText(element),
      elementPath: getElementPath(element),
      hierarchy: getElementHierarchy(element),
      colors: extractElementColors(element),
    };
  }

  // Helper function to get element class name consistently
  function getElementClassName(element) {
    if (!element.className) return '';

    if (typeof element.className === 'string') {
      return element.className;
    } else if (element.className.baseVal !== undefined) {
      return element.className.baseVal;
    } else {
      return element.className.toString();
    }
  }

  // Function to get element path (breadcrumb)
  function getElementPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let pathSegment = current.tagName.toLowerCase();

      if (current.id) {
        pathSegment += `#${current.id}`;
      } else if (current.className) {
        const className = getElementClassName(current);
        if (className.trim()) {
          const firstClass = className.trim().split(/\s+/)[0];
          pathSegment += `.${firstClass}`;
        }
      }

      path.unshift(pathSegment);
      current = current.parentElement;

      // Limit path length
      if (path.length >= 5) break;
    }

    return path.join(' > ');
  }

  // Function to create element summary for tree view
  function createElementSummary(element) {
    if (!element || element === document.documentElement) return null;

    const tagName = element.tagName.toLowerCase();
    const id = element.id || '';
    const className = getElementClassName(element);
    const classes = className
      .trim()
      .split(/\s+/)
      .filter((c) => c && !c.startsWith('inspector-'));

    // Build a CSS selector for this element
    let selector = tagName;
    if (id) {
      selector += `#${id}`;
    } else if (classes.length > 0) {
      selector += `.${classes[0]}`;
    }

    // Get display text (tag + id/class preview)
    let displayText = tagName;
    if (id) {
      displayText = `${tagName}#${id}`;
    } else if (classes.length > 0) {
      displayText = `${tagName}.${classes.slice(0, 2).join('.')}`;
    }

    return {
      tagName,
      id,
      classes,
      selector,
      displayText,
      hasChildren: element.children.length > 0,
    };
  }

  // Function to get element hierarchy (parents and children)
  function getElementHierarchy(element) {
    const parents = [];
    const children = [];
    const siblings = [];

    // Get parent chain up to body
    let current = element.parentElement;
    while (current && current !== document.documentElement) {
      const summary = createElementSummary(current);
      if (summary) {
        parents.unshift(summary); // Add to beginning so body is first
      }
      current = current.parentElement;
    }

    // Get direct children (limit to 20)
    const childElements = Array.from(element.children).slice(0, 20);
    for (const child of childElements) {
      const summary = createElementSummary(child);
      if (summary) {
        children.push(summary);
      }
    }

    // Get siblings (limit to 10)
    if (element.parentElement) {
      const siblingElements = Array.from(element.parentElement.children)
        .filter((el) => el !== element)
        .slice(0, 10);
      for (const sibling of siblingElements) {
        const summary = createElementSummary(sibling);
        if (summary) {
          siblings.push(summary);
        }
      }
    }

    // Current element summary
    const current_element = createElementSummary(element);

    return {
      parents,
      current: current_element,
      children,
      siblings,
      totalChildren: element.children.length,
      totalSiblings: element.parentElement ? element.parentElement.children.length - 1 : 0,
    };
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!isInspectorActive) return;

    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    // Remove previous highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
    }

    // Add highlight to current element
    target.classList.add('inspector-highlight');
    currentHighlight = target;

    const elementInfo = createElementInfo(target);

    // Send message to parent
    window.parent.postMessage(
      {
        type: 'INSPECTOR_HOVER',
        elementInfo: elementInfo,
      },
      '*',
    );
  }

  function handleClick(e) {
    if (!isInspectorActive) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    // Store the selected element for future edits
    selectedElement = target;

    // Store original styles and text for revert functionality
    originalStyles = {};
    const computedStyles = window.getComputedStyle(target);
    const relevantProps = [
      'display',
      'position',
      'width',
      'height',
      'margin',
      'padding',
      'border',
      'background',
      'background-color',
      'color',
      'font-size',
      'font-weight',
      'font-family',
      'text-align',
      'flex-direction',
      'justify-content',
      'align-items',
      'gap',
      'border-radius',
      'box-shadow',
      'opacity',
      'overflow',
    ];
    relevantProps.forEach((prop) => {
      originalStyles[prop] = computedStyles.getPropertyValue(prop);
    });
    originalText = target.textContent || '';

    const elementInfo = createElementInfo(target);

    // Send message to parent
    window.parent.postMessage(
      {
        type: 'INSPECTOR_CLICK',
        elementInfo: elementInfo,
      },
      '*',
    );

    // Show resize handles for selected element
    showResizeHandles(target);
  }

  // Create and show resize handles around selected element
  function showResizeHandles(element) {
    // Remove existing handles
    hideResizeHandles();

    if (!element || element === document.body) return;

    const rect = element.getBoundingClientRect();

    // Create handles container
    resizeHandles = document.createElement('div');
    resizeHandles.className = 'inspector-resize-handles';
    resizeHandles.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 999999;
    `;

    // Handle positions: top-left, top-right, bottom-left, bottom-right, and edges
    const handles = [
      { pos: 'nw', cursor: 'nw-resize', top: '-4px', left: '-4px' },
      { pos: 'ne', cursor: 'ne-resize', top: '-4px', right: '-4px' },
      { pos: 'sw', cursor: 'sw-resize', bottom: '-4px', left: '-4px' },
      { pos: 'se', cursor: 'se-resize', bottom: '-4px', right: '-4px' },
      { pos: 'n', cursor: 'n-resize', top: '-4px', left: '50%', transform: 'translateX(-50%)' },
      { pos: 's', cursor: 's-resize', bottom: '-4px', left: '50%', transform: 'translateX(-50%)' },
      { pos: 'w', cursor: 'w-resize', top: '50%', left: '-4px', transform: 'translateY(-50%)' },
      { pos: 'e', cursor: 'e-resize', top: '50%', right: '-4px', transform: 'translateY(-50%)' },
    ];

    handles.forEach(({ pos, cursor, ...styles }) => {
      const handle = document.createElement('div');
      handle.className = `inspector-handle inspector-handle-${pos}`;
      handle.dataset.position = pos;

      let styleStr = `
        position: absolute;
        width: 8px;
        height: 8px;
        background: #3b82f6;
        border: 1px solid white;
        border-radius: 2px;
        cursor: ${cursor};
        pointer-events: auto;
      `;

      Object.entries(styles).forEach(([key, val]) => {
        styleStr += `${key}: ${val};`;
      });

      handle.style.cssText = styleStr;

      // Add mouse events
      handle.addEventListener('mousedown', (e) => startResize(e, pos));

      resizeHandles.appendChild(handle);
    });

    // Add dimension display
    const dimensions = document.createElement('div');
    dimensions.className = 'inspector-dimensions';
    dimensions.style.cssText = `
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
    `;
    dimensions.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    resizeHandles.appendChild(dimensions);

    document.body.appendChild(resizeHandles);
  }

  // Hide resize handles
  function hideResizeHandles() {
    if (resizeHandles) {
      resizeHandles.remove();
      resizeHandles = null;
    }
  }

  // Update resize handles position
  function updateResizeHandles() {
    if (!resizeHandles || !selectedElement) return;

    const rect = selectedElement.getBoundingClientRect();
    resizeHandles.style.top = `${rect.top}px`;
    resizeHandles.style.left = `${rect.left}px`;
    resizeHandles.style.width = `${rect.width}px`;
    resizeHandles.style.height = `${rect.height}px`;

    // Update dimensions display
    const dimensions = resizeHandles.querySelector('.inspector-dimensions');
    if (dimensions) {
      dimensions.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }
  }

  // Start resize operation
  function startResize(e, position) {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedElement) return;

    isResizing = true;
    resizeHandle = position;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;

    const rect = selectedElement.getBoundingClientRect();
    resizeStartWidth = rect.width;
    resizeStartHeight = rect.height;

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }

  // Handle resize drag
  function handleResize(e) {
    if (!isResizing || !selectedElement) return;

    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;

    let newWidth = resizeStartWidth;
    let newHeight = resizeStartHeight;

    // Calculate new dimensions based on handle position
    if (resizeHandle.includes('e')) newWidth = resizeStartWidth + deltaX;
    if (resizeHandle.includes('w')) newWidth = resizeStartWidth - deltaX;
    if (resizeHandle.includes('s')) newHeight = resizeStartHeight + deltaY;
    if (resizeHandle.includes('n')) newHeight = resizeStartHeight - deltaY;

    // Ensure minimum size
    newWidth = Math.max(20, newWidth);
    newHeight = Math.max(20, newHeight);

    // Apply new dimensions
    selectedElement.style.width = `${newWidth}px`;
    selectedElement.style.height = `${newHeight}px`;

    // Update handles position
    updateResizeHandles();

    // Notify parent of resize
    window.parent.postMessage(
      {
        type: 'INSPECTOR_RESIZE',
        width: newWidth,
        height: newHeight,
      },
      '*',
    );
  }

  // Stop resize operation
  function stopResize() {
    isResizing = false;
    resizeHandle = null;

    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);

    // Send final element info
    if (selectedElement) {
      const elementInfo = createElementInfo(selectedElement);
      window.parent.postMessage(
        {
          type: 'INSPECTOR_RESIZE_END',
          elementInfo: elementInfo,
        },
        '*',
      );
    }
  }

  // Handle style edits from the parent
  function handleStyleEdit(property, value) {
    if (!selectedElement) return;

    try {
      // Convert CSS property name to camelCase for JS style manipulation
      const camelCaseProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      selectedElement.style[camelCaseProperty] = value;

      // Send confirmation back to parent
      window.parent.postMessage(
        {
          type: 'INSPECTOR_EDIT_APPLIED',
          property: property,
          value: value,
          success: true,
        },
        '*',
      );
    } catch (error) {
      window.parent.postMessage(
        {
          type: 'INSPECTOR_EDIT_APPLIED',
          property: property,
          value: value,
          success: false,
          error: error.message,
        },
        '*',
      );
    }
  }

  // Handle text content edits from the parent
  function handleTextEdit(text) {
    if (!selectedElement) return;

    try {
      // Only edit text content for elements that primarily contain text
      const textElements = [
        'span',
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'button',
        'a',
        'label',
        'div',
        'li',
        'td',
        'th',
      ];
      const tagName = selectedElement.tagName.toLowerCase();

      if (textElements.includes(tagName)) {
        // If element has only text (no child elements with important content)
        if (selectedElement.children.length === 0 || selectedElement.childNodes.length === 1) {
          selectedElement.textContent = text;
        } else {
          // Find the first text node and update it
          for (let node of selectedElement.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
              node.textContent = text;
              break;
            }
          }
        }
      }

      window.parent.postMessage(
        {
          type: 'INSPECTOR_TEXT_APPLIED',
          text: text,
          success: true,
        },
        '*',
      );
    } catch (error) {
      window.parent.postMessage(
        {
          type: 'INSPECTOR_TEXT_APPLIED',
          text: text,
          success: false,
          error: error.message,
        },
        '*',
      );
    }
  }

  function handleMouseLeave() {
    if (!isInspectorActive) return;

    // Remove highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
      currentHighlight = null;
    }

    // Send message to parent
    window.parent.postMessage(
      {
        type: 'INSPECTOR_LEAVE',
      },
      '*',
    );
  }

  // Function to activate/deactivate inspector
  function setInspectorActive(active) {
    isInspectorActive = active;

    if (active) {
      // Add inspector styles
      if (!inspectorStyle) {
        inspectorStyle = document.createElement('style');
        inspectorStyle.textContent = `
          .inspector-active * {
            cursor: crosshair !important;
          }
          .inspector-highlight {
            outline: 2px solid #3b82f6 !important;
            outline-offset: -2px !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
          .inspector-bulk-highlight {
            outline: 2px solid #a855f7 !important;
            outline-offset: -2px !important;
            background-color: rgba(168, 85, 247, 0.15) !important;
            transition: outline 0.3s, background-color 0.3s;
          }
        `;
        document.head.appendChild(inspectorStyle);
      }

      document.body.classList.add('inspector-active');

      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mouseleave', handleMouseLeave, true);
    } else {
      document.body.classList.remove('inspector-active');

      // Remove highlight
      if (currentHighlight) {
        currentHighlight.classList.remove('inspector-highlight');
        currentHighlight = null;
      }

      // Hide resize handles
      hideResizeHandles();

      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);

      // Remove styles
      if (inspectorStyle) {
        inspectorStyle.remove();
        inspectorStyle = null;
      }
    }
  }

  // Handler for selecting element by CSS selector (from tree navigator)
  function handleSelectBySelector(selector) {
    try {
      // Try to find the element using the selector
      const element = document.querySelector(selector);

      if (element) {
        // Remove previous selection highlight
        if (selectedElement) {
          selectedElement.classList.remove('inspector-selected');
        }

        // Remove previous hover highlight
        if (currentHighlight) {
          currentHighlight.classList.remove('inspector-highlight');
          currentHighlight = null;
        }

        // Select the new element
        selectedElement = element;
        element.classList.add('inspector-selected');

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Show resize handles for new selection
        showResizeHandles(element);

        // Create element info and send to parent
        const elementInfo = createElementInfo(element);
        window.parent.postMessage(
          {
            type: 'INSPECTOR_CLICK',
            elementInfo: elementInfo,
          },
          '*',
        );
      } else {
        console.warn('[Inspector] Element not found for selector:', selector);
      }
    } catch (error) {
      console.error('[Inspector] Error selecting element by selector:', error);
    }
  }

  // Handler for applying bulk styles to all matching elements
  function handleBulkStyleEdit(selector, property, value) {
    console.log('[Inspector] Bulk style edit:', selector, property, value);

    try {
      // Find all matching elements
      const elements = document.querySelectorAll(selector);

      if (elements.length === 0) {
        window.parent.postMessage(
          {
            type: 'INSPECTOR_BULK_APPLIED',
            selector: selector,
            property: property,
            value: value,
            count: 0,
            success: false,
            error: 'No matching elements found',
          },
          '*',
        );
        return;
      }

      // Convert CSS property to camelCase
      const camelCaseProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

      // Store original styles and apply new ones
      elements.forEach((element) => {
        // Create a unique key for this element+property combo
        const key = `${selector}|${getElementUniqueId(element)}`;

        if (!bulkOriginalStyles.has(key)) {
          bulkOriginalStyles.set(key, {});
        }

        const originalMap = bulkOriginalStyles.get(key);

        // Store original value if not already stored
        if (!(property in originalMap)) {
          originalMap[property] = element.style[camelCaseProperty] || '';
        }

        // Apply the new style
        element.style[camelCaseProperty] = value;
      });

      // Brief highlight of affected elements
      elements.forEach((element) => {
        element.classList.add('inspector-bulk-highlight');
      });

      setTimeout(() => {
        elements.forEach((element) => {
          element.classList.remove('inspector-bulk-highlight');
        });
      }, 500);

      window.parent.postMessage(
        {
          type: 'INSPECTOR_BULK_APPLIED',
          selector: selector,
          property: property,
          value: value,
          count: elements.length,
          success: true,
        },
        '*',
      );
    } catch (error) {
      console.error('[Inspector] Bulk style error:', error);
      window.parent.postMessage(
        {
          type: 'INSPECTOR_BULK_APPLIED',
          selector: selector,
          property: property,
          value: value,
          count: 0,
          success: false,
          error: error.message,
        },
        '*',
      );
    }
  }

  // Helper function to generate a unique identifier for an element
  function getElementUniqueId(element) {
    if (element.id) return `#${element.id}`;

    // Create path-based identifier
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let segment = current.tagName.toLowerCase();
      if (current.id) {
        segment += `#${current.id}`;
        path.unshift(segment);
        break;
      } else {
        const siblings = current.parentElement?.children || [];
        const index = Array.from(siblings).indexOf(current);
        segment += `:nth-child(${index + 1})`;
      }
      path.unshift(segment);
      current = current.parentElement;
    }
    return path.join('>');
  }

  // Handler for reverting bulk style changes
  function handleBulkRevert(selector) {
    console.log('[Inspector] Bulk revert:', selector);

    try {
      const elements = document.querySelectorAll(selector);
      let revertedCount = 0;

      elements.forEach((element) => {
        const key = `${selector}|${getElementUniqueId(element)}`;
        const originalMap = bulkOriginalStyles.get(key);

        if (originalMap) {
          Object.entries(originalMap).forEach(([prop, value]) => {
            const camelCaseProperty = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            element.style[camelCaseProperty] = value;
          });
          bulkOriginalStyles.delete(key);
          revertedCount++;
        }
      });

      window.parent.postMessage(
        {
          type: 'INSPECTOR_BULK_REVERTED',
          selector: selector,
          count: revertedCount,
          success: true,
        },
        '*',
      );
    } catch (error) {
      window.parent.postMessage(
        {
          type: 'INSPECTOR_BULK_REVERTED',
          selector: selector,
          success: false,
          error: error.message,
        },
        '*',
      );
    }
  }

  // Handler for counting matching elements
  function handleCountElements(selector) {
    try {
      const elements = document.querySelectorAll(selector);
      window.parent.postMessage(
        {
          type: 'INSPECTOR_ELEMENT_COUNT',
          selector: selector,
          count: elements.length,
        },
        '*',
      );
    } catch (error) {
      window.parent.postMessage(
        {
          type: 'INSPECTOR_ELEMENT_COUNT',
          selector: selector,
          count: 0,
          error: error.message,
        },
        '*',
      );
    }
  }

  // Listen for messages from parent
  window.addEventListener('message', function (event) {
    console.log('[Inspector] Received message:', event.data.type, event.data);

    if (event.data.type === 'INSPECTOR_ACTIVATE') {
      setInspectorActive(event.data.active);
    } else if (event.data.type === 'INSPECTOR_EDIT_STYLE') {
      console.log(
        '[Inspector] Edit style:',
        event.data.property,
        '=',
        event.data.value,
        'selectedElement:',
        selectedElement,
      );
      handleStyleEdit(event.data.property, event.data.value);
    } else if (event.data.type === 'INSPECTOR_EDIT_TEXT') {
      console.log('[Inspector] Edit text:', event.data.text, 'selectedElement:', selectedElement);
      handleTextEdit(event.data.text);
    } else if (event.data.type === 'INSPECTOR_SELECT_BY_SELECTOR') {
      console.log('[Inspector] Select by selector:', event.data.selector);
      handleSelectBySelector(event.data.selector);
    } else if (event.data.type === 'INSPECTOR_REVERT') {
      console.log('[Inspector] Revert changes');
      handleRevert();
    } else if (event.data.type === 'INSPECTOR_BULK_STYLE') {
      console.log('[Inspector] Bulk style:', event.data.selector, event.data.property, event.data.value);
      handleBulkStyleEdit(event.data.selector, event.data.property, event.data.value);
    } else if (event.data.type === 'INSPECTOR_BULK_REVERT') {
      console.log('[Inspector] Bulk revert:', event.data.selector);
      handleBulkRevert(event.data.selector);
    } else if (event.data.type === 'INSPECTOR_COUNT_ELEMENTS') {
      console.log('[Inspector] Count elements:', event.data.selector);
      handleCountElements(event.data.selector);
    }
  });

  // Handler for reverting all changes on selected element
  function handleRevert() {
    if (!selectedElement) return;

    try {
      // Revert all styles
      Object.entries(originalStyles).forEach(([prop, value]) => {
        const camelCaseProperty = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        selectedElement.style[camelCaseProperty] = '';
      });

      // Revert text content if it was changed
      if (originalText && selectedElement.textContent !== originalText) {
        selectedElement.textContent = originalText;
      }

      // Create updated element info and send to parent
      const elementInfo = createElementInfo(selectedElement);
      window.parent.postMessage(
        {
          type: 'INSPECTOR_REVERTED',
          elementInfo: elementInfo,
          success: true,
        },
        '*',
      );
    } catch (error) {
      window.parent.postMessage(
        {
          type: 'INSPECTOR_REVERTED',
          success: false,
          error: error.message,
        },
        '*',
      );
    }
  }

  // Auto-inject if inspector is already active
  window.parent.postMessage({ type: 'INSPECTOR_READY' }, '*');
})();
