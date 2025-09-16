/**
 * DOM Module
 * Handles DOM element management and validation
 */
const DOMModule = (() => {
  // DOM Element References
  const elements = {
    setup: null,
    waiting: null,
    shareRoom: null,
    roomIdDisplay: null,
    copyBtn: null,
    game: null,
    roomIdInput: null,
    playerChoice: null,
    opponentChoice: null,
    result: null,
    playerScore: null,
    opponentScore: null,
    resetConfirm: null,
    rockBtn: null,
    paperBtn: null,
    scissorsBtn: null,
    totalRounds: null,
    totalTies: null,
    firebaseError: null
  };

  /**
   * Initialize DOM elements
   */
  const initializeElements = () => {
    const elementIds = {
      setup: 'setup',
      waiting: 'waiting',
      shareRoom: 'share-room',
      roomIdDisplay: 'room-id-display',
      copyBtn: 'copy-btn',
      game: 'game',
      roomIdInput: 'roomId',
      playerChoice: 'player-choice',
      opponentChoice: 'opponent-choice',
      result: 'result',
      playerScore: 'player-score',
      opponentScore: 'opponent-score',
      resetConfirm: 'reset-confirm',
      rockBtn: 'rock-btn',
      paperBtn: 'paper-btn',
      scissorsBtn: 'scissors-btn',
      totalRounds: 'total-rounds',
      totalTies: 'total-ties',
      firebaseError: 'firebase-error'
    };

    // Get all elements
    for (const [key, id] of Object.entries(elementIds)) {
      elements[key] = document.getElementById(id);
    }

    return verifyElements();
  };

  /**
   * Verify all required DOM elements exist
   */
  const verifyElements = () => {
    const missingElements = [];
    
    for (const [key, element] of Object.entries(elements)) {
      if (!element) {
        missingElements.push(key);
        console.error(`Missing DOM element: ${key}`);
      }
    }

    if (missingElements.length > 0) {
      console.error('Missing DOM elements:', missingElements);
      return false;
    }

    console.log('All DOM elements verified successfully');
    return true;
  };

  /**
   * Get specific element
   */
  const getElement = (elementName) => {
    if (!elements[elementName]) {
      console.warn(`Element '${elementName}' not found`);
      return null;
    }
    return elements[elementName];
  };

  /**
   * Get all elements
   */
  const getAllElements = () => {
    return { ...elements };
  };

  /**
   * Show element
   */
  const showElement = (elementName) => {
    const element = getElement(elementName);
    if (element) {
      element.style.display = 'block';
    }
  };

  /**
   * Hide element
   */
  const hideElement = (elementName) => {
    const element = getElement(elementName);
    if (element) {
      element.style.display = 'none';
    }
  };

  /**
   * Set element text content
   */
  const setElementText = (elementName, text) => {
    const element = getElement(elementName);
    if (element) {
      element.textContent = text;
    }
  };

  /**
   * Get element text content
   */
  const getElementText = (elementName) => {
    const element = getElement(elementName);
    return element ? element.textContent : '';
  };

  /**
   * Set element value (for inputs)
   */
  const setElementValue = (elementName, value) => {
    const element = getElement(elementName);
    if (element && 'value' in element) {
      element.value = value;
    }
  };

  /**
   * Get element value (for inputs)
   */
  const getElementValue = (elementName) => {
    const element = getElement(elementName);
    return element && 'value' in element ? element.value : '';
  };

  /**
   * Set button disabled state
   */
  const setButtonDisabled = (elementName, disabled) => {
    const element = getElement(elementName);
    if (element && element.tagName === 'BUTTON') {
      element.disabled = disabled;
    }
  };

  /**
   * Set button style
   */
  const setButtonStyle = (elementName, styles) => {
    const element = getElement(elementName);
    if (element) {
      Object.assign(element.style, styles);
    }
  };

  /**
   * Add event listener to element
   */
  const addEventListener = (elementName, event, handler) => {
    const element = getElement(elementName);
    if (element) {
      element.addEventListener(event, handler);
    }
  };

  /**
   * Remove event listener from element
   */
  const removeEventListener = (elementName, event, handler) => {
    const element = getElement(elementName);
    if (element) {
      element.removeEventListener(event, handler);
    }
  };

  // Public API
  return {
    initializeElements,
    verifyElements,
    getElement,
    getAllElements,
    showElement,
    hideElement,
    setElementText,
    getElementText,
    setElementValue,
    getElementValue,
    setButtonDisabled,
    setButtonStyle,
    addEventListener,
    removeEventListener
  };
})();