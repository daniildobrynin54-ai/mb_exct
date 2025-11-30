/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./api.js":
/*!****************!*\
  !*** ./api.js ***!
  \****************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   activeRequests: () => (/* binding */ activeRequests),
/* harmony export */   csrfToken: () => (/* binding */ csrfToken),
/* harmony export */   getOwnersCount: () => (/* binding */ getOwnersCount),
/* harmony export */   getWishlistCount: () => (/* binding */ getWishlistCount),
/* harmony export */   pendingRequests: () => (/* binding */ pendingRequests),
/* harmony export */   setCsrfToken: () => (/* binding */ setCsrfToken)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./config.js */ "./config.js");
// api.js (С ОПТИМИЗАЦИЕЙ ПО ПАГИНАЦИИ)



const pendingRequests = new Map();
let activeRequests = 0;
let csrfToken = null;

const setCsrfToken = (token) => {
    csrfToken = token;
}

const getLastPageNumber = (doc) => {
    const paginationButtons = doc.querySelectorAll('ul.pagination li.pagination__button a[href*="page="]');
    let maxPage = 1;
    paginationButtons.forEach(link => {
        const url = link.getAttribute('href');
        const match = url.match(/page=(\d+)/);
        if (match && match[1]) {
            const pageNum = parseInt(match[1], 10);
            if (!isNaN(pageNum) && pageNum > maxPage) {
                maxPage = pageNum;
            }
        }
    });
    return maxPage;
};

const countItemsOnPage = (doc, type) => {
    const selector = type === 'wishlist' ? '.profile__friends-item' : '.card-show__owner';
    return doc.querySelectorAll(selector).length;
};

const getUserCount = async (type, cardId, retries = 2) => {
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) return 0;

  const cacheKey = `${type}_${cardId}`;
  if (!csrfToken) {
      csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  }

  try {
    const cached = await chrome.storage.local.get([cacheKey]).then(r => r[cacheKey]);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.count;
    }
  } catch (error) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error accessing local storage for cache key ${cacheKey}:`, error);
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Getting OPTIMIZED ${type} count for card ${cardId}`);
  const requestPromise = (async () => {
    while (activeRequests >= _config_js__WEBPACK_IMPORTED_MODULE_1__.MAX_CONCURRENT_REQUESTS) {
        await new Promise(r => setTimeout(r, 100));
    }
    activeRequests++;

    let total = 0; 

    try {
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error('Extension context lost before first page fetch');

        let responsePage1 = await chrome.runtime.sendMessage({
            action: `fetch${type.charAt(0).toUpperCase() + type.slice(1)}Count`,
            cardId,
            page: 1, 
            csrfToken
        });

        if (!responsePage1 || !responsePage1.success || !responsePage1.text) {
            if (responsePage1?.error?.includes('404')) {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Card ${cardId} not found for ${type} (404 on page 1). Count is 0.`);
                 total = 0;
            } else {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Failed to fetch page 1 for ${type} count, card ${cardId}:`, responsePage1?.error || 'No response or text');
                 if (retries > 0) {
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Retrying fetch for card ${cardId} (page 1), retries left: ${retries - 1}`);
                     activeRequests--;
                     pendingRequests.delete(cacheKey);
                     return await getUserCount(type, cardId, retries - 1); 
                 }
                 throw new Error(`Failed to fetch page 1 after retries for card ${cardId}`);
            }
        } else {
            const docPage1 = new DOMParser().parseFromString(responsePage1.text, 'text/html');
            const countPerPage = countItemsOnPage(docPage1, type);
            const lastPageNum = getLastPageNumber(docPage1);
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Page 1 fetched: countPerPage=${countPerPage}, lastPageNum=${lastPageNum}`);

            if (lastPageNum <= 1) {
                total = countPerPage;
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Only one page found. Total ${type} count: ${total}`);
            } else {
                if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error('Extension context lost before last page fetch');

                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Fetching last page (${lastPageNum}) for card ${cardId}`);
                 let responseLastPage = await chrome.runtime.sendMessage({
                     action: `fetch${type.charAt(0).toUpperCase() + type.slice(1)}Count`,
                     cardId,
                     page: lastPageNum, 
                     csrfToken
                 });

                 if (!responseLastPage || !responseLastPage.success || !responseLastPage.text) {
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Failed to fetch last page (${lastPageNum}) for ${type} count, card ${cardId}:`, responseLastPage?.error || 'No response or text');
                      total = 0; 
                      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Could not calculate total count accurately due to last page fetch error.`);
                 } else {
                     const docLastPage = new DOMParser().parseFromString(responseLastPage.text, 'text/html');
                     const countOnLastPage = countItemsOnPage(docLastPage, type);
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Last page (${lastPageNum}) fetched: countOnLastPage=${countOnLastPage}`);

                     total = (countPerPage * (lastPageNum - 1)) + countOnLastPage;
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Calculated total ${type} count: (${countPerPage} * ${lastPageNum - 1}) + ${countOnLastPage} = ${total}`);
                 }
            }
        }

      if ((0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)() && total >= 0) {
          try {
            await chrome.storage.local.set({ [cacheKey]: { count: total, timestamp: Date.now() } });
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Fetched (Optimized) and cached ${type} count for card ${cardId}: ${total}`);
          } catch (storageError) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error setting local storage for cache key ${cacheKey}:`, storageError);
          }
      } else if (total < 0) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Fetch resulted in invalid count (${total}) for ${type}, card ${cardId}. Not caching.`);
          total = 0; 
      }
      return total; 

    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Unhandled error during OPTIMIZED ${type} count fetch for card ${cardId}:`, error);
        if (retries > 0 && error.message !== 'Extension context lost before first page fetch' && error.message !== 'Extension context lost before last page fetch') {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Retrying entire optimized fetch for card ${cardId} due to error: ${error.message}`);
            activeRequests--;
            pendingRequests.delete(cacheKey);
            return await getUserCount(type, cardId, retries - 1); 
        }
        return 0; 
    } finally {
      activeRequests--;
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

const getWishlistCount = cardId => getUserCount('wishlist', cardId);
const getOwnersCount = cardId => getUserCount('owners', cardId);

/***/ }),

/***/ "./cardProcessor.js":
/*!**************************!*\
  !*** ./cardProcessor.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   processCards: () => (/* binding */ processCards)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api.js */ "./api.js");
/* harmony import */ var _domUtils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./domUtils.js */ "./domUtils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _main_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./main.js */ "./main.js");
// cardProcessor.js (ИСПРАВЛЕННЫЙ v4 - Always Show)




 

// Обработка карт
const processCards = async (context, settings) => { 
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) return;

  const selector = _config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context];
  if (!selector) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`No selector defined for context: ${context}`);
      return;
  }

  const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.getElements)(selector);
  if (!cardItems.length) return;

  const BATCH_SIZE = 10;

  for (let i = 0; i < cardItems.length; i += BATCH_SIZE) {
    const batch = cardItems.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (item) => {
      let cardId = null;
      try { 
        if (context === 'trade') cardId = item.getAttribute('href')?.match(/\/cards\/(\d+)/)?.[1];
        else if (context === 'tradeOffer') cardId = item.getAttribute('data-card-id');
        else if (context === 'pack') cardId = item.getAttribute('data-id');
        else if (context === 'deckView') cardId = item.getAttribute('data-card-id');
        else cardId = item.getAttribute('data-card-id') || item.getAttribute('data-id');

        if (!cardId) { 
            throw new Error('Card ID not found');
        }
      } catch (idError) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Skipping item in ${context} due to ID error:`, idError.message, item.outerHTML);
          return;
      }

      const showWishlist = settings.alwaysShowWishlist || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.wishlist;
      const showOwners = settings.alwaysShowOwners || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.owners;

      if (context === 'deckView' || context === 'userCards') { /* ... */ }

      item.querySelector('.wishlist-warning')?.remove();
      item.querySelector('.owners-count')?.remove();

      const tasks = [];

      if (showWishlist) {
          tasks.push(
              (0,_api_js__WEBPACK_IMPORTED_MODULE_1__.getWishlistCount)(cardId).then(count => {
                  if (!item.isConnected) return;
                  const position = (showOwners && context !== 'userCards') ? 'top' : 'top';
                  (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_2__.addTextLabel)(item, 'wishlist-warning', `${count}`, `Хотят: ${count}`, position, 'wishlist', {
                      color: count >= settings.wishlistWarning ? '#FFA500' : '#00FF00'
                  }, context);
              }).catch(error => (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error getting wishlist count for card ${cardId} in ${context}:`, error))
          );
      }

      if (showOwners) {
          tasks.push(
              (0,_api_js__WEBPACK_IMPORTED_MODULE_1__.getOwnersCount)(cardId).then(count => {
                  if (!item.isConnected) return;
                  const position = showWishlist ? 'middle' : 'top';
                  (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_2__.addTextLabel)(item, 'owners-count', `${count}`, `Владеют: ${count}`, position, 'owners', {}, context);
              }).catch(error => (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error getting owners count for card ${cardId} in ${context}:`, error))
          );
      }

      await Promise.all(tasks);
    }); 

    await Promise.all(promises);
    if (cardItems.length > BATCH_SIZE && i + BATCH_SIZE < cardItems.length) {
        await new Promise(r => setTimeout(r, 50));
    }
  } 
};

/***/ }),

/***/ "./config.js":
/*!*******************!*\
  !*** ./config.js ***!
  \*******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BASE_URL: () => (/* binding */ BASE_URL),
/* harmony export */   LOG_PREFIX: () => (/* binding */ LOG_PREFIX),
/* harmony export */   MAX_CONCURRENT_REQUESTS: () => (/* binding */ MAX_CONCURRENT_REQUESTS),
/* harmony export */   contextsSelectors: () => (/* binding */ contextsSelectors),
/* harmony export */   getCurrentContext: () => (/* binding */ getCurrentContext),
/* harmony export */   initialContextState: () => (/* binding */ initialContextState)
/* harmony export */ });
const BASE_URL = 'https://mangabuff.ru';
const LOG_PREFIX = '[MangaBuffExt]';
const MAX_CONCURRENT_REQUESTS = 5; 

const initialContextState = {
  userCards: { wishlist: false },
  trade: { wishlist: true, owners: true },
  tradeOffer: { wishlist: false, owners: false },
  remelt: { wishlist: false, owners: false },
  market: { wishlist: false, owners: false },
  split: { wishlist: false, owners: false },
  pack: { wishlist: true, owners: false },
  deckCreate: { wishlist: false, owners: false },
  marketCreate: { wishlist: false, owners: false },
  marketRequestCreate: { wishlist: false, owners: false },
  marketRequestView: { wishlist: true, owners: false }, 
  deckView: { wishlist: false, owners: false },
  quizPage: {},
  minePage: {}
};

const contextsSelectors = {
  userCards: '.manga-cards__item[data-card-id]',
  trade: '.trade__main-item',
  tradeOffer: '.trade__inventory-item',
  remelt: '.card-filter-list__card',
  pack: '.lootbox__card[data-id]',
  market: '.card-filter-list__card',
  split: '.card-filter-list__card',
  deckCreate: '.card-filter-list__card',
  marketCreate: '.card-filter-list__card',
  marketRequestCreate: '.card-filter-list__card[data-card-id]',
  marketRequestView: '.card-pool__item[data-id]', 
  deckView: '.deck__item',
};

const getCurrentContext = () => {
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search); 

  const contextsMap = {
    '/users/\\d+/cards': 'userCards',
    '/trades/\\d+': 'trade',
    '/trades/offers/\\d+': 'tradeOffer',
    '/cards/pack': 'pack',
    '/cards/remelt': 'remelt',
    '/market/\\d+': 'market', 
    '/cards/split': 'split',
    '/market/create': 'marketCreate',
    '/decks/create': 'deckCreate',
    '/decks/\\d+': 'deckView',
    '/quiz': 'quizPage',
    '/mine': 'minePage',
    '/market/requests/create': 'marketRequestCreate',
    '/market/requests/\\d+': 'marketRequestView' 
  };
  for (const [pattern, context] of Object.entries(contextsMap)) {
    const regex = new RegExp(`^${pattern}$`);
    if (context === 'marketRequestCreate' && path === '/market/requests/create') {
      console.log(`${LOG_PREFIX} Detected context: ${context}`);
      return context;
    } else if (regex.test(path)) {
      console.log(`${LOG_PREFIX} Detected context: ${context}`);
      return context;
    }
  }
  console.log(`${LOG_PREFIX} No context detected for path: ${path}`);
  return null;
};

/***/ }),

/***/ "./contextHandlers.js":
/*!****************************!*\
  !*** ./contextHandlers.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleMarketCreatePage: () => (/* binding */ handleMarketCreatePage),
/* harmony export */   initPackPage: () => (/* binding */ initPackPage),
/* harmony export */   initStatsButtons: () => (/* binding */ initStatsButtons),
/* harmony export */   initUserCards: () => (/* binding */ initUserCards)
/* harmony export */ });
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./settings.js */ "./settings.js");
/* harmony import */ var _cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./cardProcessor.js */ "./cardProcessor.js");
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _main_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./main.js */ "./main.js");




 

const initUserCards = async () => {
  const controlsContainer = document.querySelector('.card-controls.scroll-hidden');
  if (!controlsContainer) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('initUserCards: Controls container not found.');
      return;
  }
  controlsContainer.querySelector('.wishlist-toggle-btn')?.remove();

  const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
  const toggleBtn = document.createElement('button');
  toggleBtn.classList.add('button', 'wishlist-toggle-btn');
  toggleBtn.style.marginLeft = '10px';
  controlsContainer.appendChild(toggleBtn);

  const updateUserCardButtonState = () => {
      (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)().then(currentSettings => {
          const currentContextState = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState['userCards'] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState['userCards']; 
          if (currentSettings.alwaysShowWishlist) {
              toggleBtn.textContent = 'Желающие (всегда)';
              toggleBtn.disabled = true;
              toggleBtn.style.opacity = '0.7';
              if (_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards) _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards.wishlist = true;
          } else {
              const isActive = currentContextState.wishlist;
              toggleBtn.textContent = isActive ? 'Скрыть желающих' : 'Показать желающих';
              toggleBtn.disabled = false;
              toggleBtn.style.opacity = '1';
          }
      });
  };

  updateUserCardButtonState();

  toggleBtn.addEventListener('click', async () => {
    const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
    if (currentSettings.alwaysShowWishlist) return;

    toggleBtn.disabled = true;
    toggleBtn.textContent = 'Загрузка...';

    if (_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards) {
         _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards.wishlist = !_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards.wishlist;
    } else {
         _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards = { ..._config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState.userCards, wishlist: !_config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState.userCards.wishlist };
    }

    _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.userCards); 
    await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)('userCards', currentSettings); 
    updateUserCardButtonState(); 
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`UserCards: Toggled wishlist visibility: ${_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards?.wishlist}`);
  });

  const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.getElements)(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.userCards);
  cardItems.forEach(item => {
    item.removeEventListener('contextmenu', handleUserCardContextMenu); 
    item.addEventListener('contextmenu', handleUserCardContextMenu);
  });

   const initialShowWishlist = settings.alwaysShowWishlist || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards?.wishlist;
   if (initialShowWishlist) {
       (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('initUserCards: Initial wishlist processing needed.');
       _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.userCards);
       await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)('userCards', settings);
   }
};

const handleUserCardContextMenu = async (e) => {
  e.preventDefault();
  const item = e.currentTarget; 
  const lockButton = item.querySelector('.lock-card-btn');
  const imageDiv = item.querySelector('.manga-cards__image');

  if (!lockButton) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('UserCards ContextMenu: Lock button (.lock-card-btn) not found.');
    return;
  }
  if (!imageDiv) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('UserCards ContextMenu: Image div (.manga-cards__image) not found.');
      return;
  }

  const cardInstanceId = lockButton.getAttribute('data-id');
  const bgImageStyle = imageDiv.style.backgroundImage;
  const urlMatch = bgImageStyle.match(/url\("?(.+?)"?\)/);
  const imageUrl = urlMatch ? urlMatch[1] : null;

  if (!cardInstanceId) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('UserCards ContextMenu: Missing data-id on lock button.');
    return;
  }
   if (!imageUrl) {
     (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('UserCards ContextMenu: Could not extract image URL from style:', bgImageStyle);
     return;
   }


  (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`UserCards ContextMenu: Right-clicked card instance ID: ${cardInstanceId}, Image: ${imageUrl}`);

  const dataToSave = {
      instanceId: cardInstanceId,
      imageUrl: imageUrl
  };

  try {
    await chrome.storage.local.set({ selectedMarketCardData: dataToSave });
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('UserCards ContextMenu: Saved card data to local storage:', dataToSave);
    window.location.href = `${_config_js__WEBPACK_IMPORTED_MODULE_3__.BASE_URL}/market/create`; 
  } catch (error) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logError)('UserCards ContextMenu: Error saving data or redirecting:', error);
    alert('Не удалось сохранить данные карты для создания лота.');
  }
};


const handleMarketCreatePage = async () => {
  (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: Entering page');
  try {
    const { selectedMarketCardData } = await chrome.storage.local.get(['selectedMarketCardData']);

    if (selectedMarketCardData && selectedMarketCardData.instanceId && selectedMarketCardData.imageUrl) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`MarketCreate: Found selected card data:`, selectedMarketCardData);

      const firstCardItem = await (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.waitForElements)(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.marketCreate, 5000, true); 
      if (!firstCardItem) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('MarketCreate: No cards loaded in time.');
          await chrome.storage.local.remove('selectedMarketCardData'); 
          return;
      }
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: First card item found:', firstCardItem);

      firstCardItem.click();
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: Clicked on the first card item.');

      const cardShowContainer = await (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.waitForElements)('.card-show', 5000, true);
      if (!cardShowContainer) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('MarketCreate: .card-show container did not appear after clicking first card.');
          await chrome.storage.local.remove('selectedMarketCardData'); 
          return;
      }
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: .card-show container appeared.');

      const cardShowHeader = cardShowContainer.querySelector('.card-show__header');
      const cardShowImage = cardShowContainer.querySelector('.card-show__image');

      if (cardShowHeader) {
          cardShowHeader.style.backgroundImage = `url("${selectedMarketCardData.imageUrl}")`;
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: Updated card-show header background image.');
      } else {
           (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('MarketCreate: .card-show__header not found.');
      }

      if (cardShowImage) {
          cardShowImage.src = selectedMarketCardData.imageUrl;
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: Updated card-show image src.');
      } else {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('MarketCreate: .card-show__image not found.');
      }

      const hiddenInputName = 'card_id'; 
      const hiddenIdInput = cardShowContainer.closest('form')?.querySelector(`input[name="${hiddenInputName}"]`); 

      if (hiddenIdInput) {
          hiddenIdInput.value = selectedMarketCardData.instanceId;
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`MarketCreate: Updated hidden input [name="${hiddenInputName}"] value to: ${selectedMarketCardData.instanceId}`);
          hiddenIdInput.dispatchEvent(new Event('input', { bubbles: true }));
          hiddenIdInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logError)(`MarketCreate: Hidden input [name="${hiddenInputName}"] not found! The lot might be created with the wrong card ID.`);
      }

      await chrome.storage.local.remove('selectedMarketCardData');
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: Removed card data from local storage. Card selection finished.');

    } else {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('MarketCreate: No selected card data found in local storage.');
      if (selectedMarketCardData) {
          await chrome.storage.local.remove('selectedMarketCardData');
      }
    }
  } catch (error) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logError)('MarketCreate: Error handling page logic:', error);
    try { await chrome.storage.local.remove('selectedMarketCardData'); } catch (e) { /* ignore cleanup error */ }
  }
};

const initStatsButtons = async (context, targetSelector, buttonClass) => {
    const targetDiv = document.querySelector(targetSelector);
    if (!targetDiv) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)(`initStatsButtons: Target selector '${targetSelector}' not found for context '${context}'.`);
        return;
    }
    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
    const currentContextState = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context]; 

    const buttonsConfig = [
      { name: 'wishlist', text: 'Желают', activeClass: `${buttonClass}--active`, dataAttr: `data-${context}-wishlist-btn` },
      { name: 'owners', text: 'Владеют', activeClass: `${buttonClass}--active`, dataAttr: `data-${context}-owners-btn` }
    ];

    let nextSiblingElement = null;
    if (context === 'tradeOffer') {
        const possibleButtons = targetDiv.querySelectorAll('button, a.button, .button');
        nextSiblingElement = Array.from(possibleButtons).find(el => el.textContent.trim().includes('Анимированные'));
    }

    buttonsConfig.forEach(({ name, text, activeClass, dataAttr }) => {
      const alwaysShowSetting = name === 'wishlist' ? settings.alwaysShowWishlist : settings.alwaysShowOwners;
      const existingButton = targetDiv.querySelector(`[${dataAttr}]`);

      let btn = existingButton; 

      if (!btn) {
        btn = document.createElement('button');
        btn.classList.add(...buttonClass.split(' ').filter(Boolean), `${context}-${name}-btn`);
        btn.setAttribute(dataAttr, 'true');
        btn.style.display = 'inline-block';
        btn.style.verticalAlign = 'middle';
        btn.style.transition = 'background-color 0.3s ease, opacity 0.3s ease'; 
        btn.style.marginLeft = '5px'; 

        if (nextSiblingElement) {
             targetDiv.insertBefore(btn, nextSiblingElement);
        } else {
             targetDiv.appendChild(btn); 
        }

        btn.addEventListener('click', async () => {
          const currentSettingsClick = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
          const currentAlwaysShow = name === 'wishlist' ? currentSettingsClick.alwaysShowWishlist : currentSettingsClick.alwaysShowOwners;
          if (currentAlwaysShow) return; 

          btn.disabled = true;
          btn.textContent = '...';

          if (_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]) {
              _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context][name] = !_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context][name];
          } else {
              _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] = { ..._config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context], [name]: !_config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context][name] };
          }
          const isActive = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context][name]; 

          updateButtonAppearance(btn, isActive, name, activeClass, text, currentAlwaysShow); 

          _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context]);
          (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)(context, currentSettingsClick)
            .catch(err => (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logError)(`Error processing cards after ${name} toggle in ${context}:`, err))
            .finally(() => {
                 btn.disabled = false;
                 updateButtonAppearance(btn, _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.[name], name, activeClass, text, currentAlwaysShow);
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`${context}: Toggled ${name} visibility: ${_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.[name]}`);
          });
        });
      }

      updateButtonAppearance(btn, currentContextState[name], name, activeClass, text, alwaysShowSetting);
    });

    const shouldProcessInitially = (settings.alwaysShowWishlist || currentContextState.wishlist) || (settings.alwaysShowOwners || currentContextState.owners);
    if (shouldProcessInitially) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`initStatsButtons: Initial processing needed for ${context}.`);
      _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context]); 
      await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)(context, settings); 
    }
};

const updateButtonAppearance = (btn, isActive, type, activeClass, defaultText, alwaysShow) => {
    if (!btn) return; 
    const label = type === 'wishlist' ? 'Желают' : 'Владеют';
    if (alwaysShow) {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.textContent = `${label} (всегда)`;
        btn.classList.remove(activeClass); 
        btn.style.backgroundColor = '';
        btn.style.color = '';
        btn.style.borderColor = ''; 
    } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (isActive) {
            btn.classList.add(activeClass);
            btn.style.backgroundColor = '#8e44ad'; 
            btn.style.color = '#FFFFFF';
            btn.style.borderColor = '#8e44ad';
            btn.textContent = `Скрыть ${label.toLowerCase()}`;
        } else {
            btn.classList.remove(activeClass);
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.style.borderColor = '';
            btn.textContent = `Показать ${label.toLowerCase()}`;
        }
    }
}


const initPackPage = async () => {
  const packContainer = document.querySelector('.lootbox__inner');
  if (!packContainer) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('PackPage: Pack container (.lootbox__inner) not found');
    return;
  }
  const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
  const context = 'pack';
  const currentPackState = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context];

  const processExistingCards = async () => {
      if (settings.alwaysShowWishlist || currentPackState.wishlist) {
          const initialCards = packContainer.querySelectorAll(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
          if (initialCards.length > 0) {
              _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
              await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)('pack', settings);
          }
      } else {
           const existingLabels = packContainer.querySelectorAll('.wishlist-warning, .owners-count');
           existingLabels.forEach(label => label.remove());
      }
  };

  await processExistingCards();

  const observerCallback = (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.debounce)(async (mutations) => {
      if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.isExtensionContextValid)()) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('PackPage: Observer callback skipped, extension context lost.');
          return;
      }
      let cardsChanged = false;
      for (const mutation of mutations) {
          if (mutation.type === 'childList') {
              if (Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.matches?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack)) ||
                  Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.matches?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack))) {
                  cardsChanged = true;
                  break;
              }
              if (Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.querySelector?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack)) ||
                  Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.querySelector?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack))) {
                   cardsChanged = true;
                   break;
              }

          } else if (mutation.type === 'attributes' && (mutation.attributeName === 'data-id' || mutation.attributeName === 'class') && mutation.target.matches?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack)) {
              cardsChanged = true;
              break;
          }
      }

      if (cardsChanged) {
          const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)(); 
          const currentPackStateUpdated = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context]; 
          const shouldShowLabels = currentSettings.alwaysShowWishlist || currentPackStateUpdated.wishlist;

          if (shouldShowLabels) {
              _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
              await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)(context, currentSettings); 
          } else {
              const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.getElements)(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
              cardItems.forEach(item => {
                  item.querySelector('.wishlist-warning')?.remove();
                  item.querySelector('.owners-count')?.remove(); 
              });
          }
      }
  }, 300); 

  if (!packContainer._extensionObserver) {
      const observer = new MutationObserver(observerCallback);
      observer.observe(packContainer, {
          childList: true, 
          subtree: true,   
          attributes: true, 
          attributeFilter: ['data-id', 'class'] 
      });
      packContainer._extensionObserver = observer; 
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('PackPage: Setup observer for pack container');
  } else {
       (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('PackPage: Observer already exists for pack container.');
  }
};

/***/ }),

/***/ "./domUtils.js":
/*!*********************!*\
  !*** ./domUtils.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addExtensionSettingsButton: () => (/* binding */ addExtensionSettingsButton),
/* harmony export */   addTextLabel: () => (/* binding */ addTextLabel)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");


const addTextLabel = (container, className, text, title, position, type, options = {}, context) => {
  if (!container || !(container instanceof HTMLElement)) {
      return;
  }

  try {
    const existingLabel = container.querySelector(`.${className}`);
    if (existingLabel) existingLabel.remove();

    const div = document.createElement('div');
    div.classList.add(className);
    div.title = title;

    const svgIconContainer = document.createElement('span');
    svgIconContainer.style.display = 'inline-flex';
    svgIconContainer.style.alignItems = 'center';

    let svgString = '';
    if (type === 'wishlist') {
      svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align: middle;">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>`;
    } else if (type === 'owners') {
      svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align: middle;">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>`;
    }
    svgIconContainer.innerHTML = svgString;

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    textSpan.style.lineHeight = '1';

    div.appendChild(svgIconContainer);
    div.appendChild(textSpan);

    const isUserCards = context === 'userCards';
    const isDeckView = context === 'deckView';
    const positionStyle = isUserCards ? 'left: 5px;' : 'right: 5px;';
    const topPosition = (position === 'top') ? '5px' : '25px';
    const deckViewStyles = isDeckView ? `
      z-index: 1000;
      font-size: 14px;
      padding: 3px 6px;
      background-color: rgba(0, 0, 0, 0.8);
      border: 1px solid ${options.color || '#FFFFFF'};
    ` : '';

    div.style.cssText = `
      position: absolute;
      top: ${topPosition};
      ${positionStyle}
      color: ${options.color || '#FFFFFF'};
      font-size: 12px;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 2px 5px;
      border-radius: 3px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 4px;
      ${deckViewStyles}
    `;

    if (isDeckView) {
         container.style.position = 'relative';
    } else {
         if (getComputedStyle(container).position === 'static') {
             container.style.position = 'relative';
         }
    }

    container.appendChild(div);

  } catch (error) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error adding label "${className}" in context "${context}":`, error, container);
  }
};


const addExtensionSettingsButton = () => {
  try {
    const menu = document.querySelector('.dropdown__content .menu--profile');
    if (!menu || menu.querySelector('.menu__item--extension-settings')) return;
    const settingsButton = document.createElement('a');
    settingsButton.classList.add('menu__item', 'menu__item--extension-settings');
    settingsButton.target = '_blank';
    settingsButton.href = chrome.runtime.getURL('interface.html');
    settingsButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
        <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
      </svg>
      Настройки расширения`;
    menu.appendChild(settingsButton);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)('Added extension settings button');
  } catch (error) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)('Error adding settings button:', error);
  }
};

/***/ }),

/***/ "./main.js":
/*!*****************!*\
  !*** ./main.js ***!
  \*****************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   contextState: () => (/* binding */ contextState)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./api.js */ "./api.js");
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./settings.js */ "./settings.js");
/* harmony import */ var _domUtils_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./domUtils.js */ "./domUtils.js");
/* harmony import */ var _cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./cardProcessor.js */ "./cardProcessor.js");
/* harmony import */ var _contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./contextHandlers.js */ "./contextHandlers.js");
/* harmony import */ var _observer_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./observer.js */ "./observer.js");
/* harmony import */ var _quizHandler_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./quizHandler.js */ "./quizHandler.js");
/* harmony import */ var _mineHandler_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./mineHandler.js */ "./mineHandler.js");











let contextState = {};
let currentObserver = null;

const cleanupExtensionFeatures = () => {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Cleaning up extension features...');

    if (currentObserver) {
        currentObserver.disconnect();
        currentObserver = null;
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Observer disconnected.');
    }

    document.getElementById('auto-quiz-start-btn')?.remove();
    document.getElementById('auto-mine-counter')?.remove();
    document.querySelector('.wishlist-toggle-btn')?.remove();
    const statButtonSelectors = [
        '.tradeOffer-wishlist-btn', '.tradeOffer-owners-btn',
        '.remelt-wishlist-btn', '.remelt-owners-btn',
        '.market-wishlist-btn', '.market-owners-btn',
        '.split-wishlist-btn', '.split-owners-btn',
        '.deckCreate-wishlist-btn', '.deckCreate-owners-btn',
        '.marketCreate-wishlist-btn', '.marketCreate-owners-btn',
        '.marketRequestCreate-wishlist-btn', '.marketRequestCreate-owners-btn',
    ];
    statButtonSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(btn => btn.remove());
    });
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Removed dynamic buttons.');

    const oldLabels = document.querySelectorAll('.wishlist-warning, .owners-count');
    oldLabels.forEach(label => label.remove());
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Removed ${oldLabels.length} labels.`);

    _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.clear();
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Cleared cached elements.');

};

const initializeObserver = (context) => {
     if (context !== 'pack' && context !== 'marketRequestView' && context !== 'quizPage' && context !== 'minePage') {
         (0,_observer_js__WEBPACK_IMPORTED_MODULE_7__.setupObserver)(context, obs => { currentObserver = obs; });
     }
}

const addQuizButton = async () => {
    ;(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Attempting to add Quiz button...');
    const buttonContainerSelector = '.quiz__header';
    const container = await (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.waitForElements)(buttonContainerSelector, 5000, true);

    if (container) {
        if (!container.querySelector('#auto-quiz-start-btn')) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Quiz header container found, adding button.');
            const quizButton = document.createElement('button');
            quizButton.id = 'auto-quiz-start-btn';
            quizButton.textContent = '⚡ Авто-Квиз';
            quizButton.title = 'Запустить автоматическое прохождение квиза';
            quizButton.classList.add('button');
            quizButton.style.marginLeft = '15px';
            quizButton.style.verticalAlign = 'middle';

            quizButton.addEventListener('click', async () => {
                if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { alert('Контекст расширения недействителен.'); return; }
                if (!_api_js__WEBPACK_IMPORTED_MODULE_2__.csrfToken) { alert('CSRF токен не найден.'); (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Quiz start blocked: CSRF token is null or empty.'); return; }

                quizButton.disabled = true;
                quizButton.textContent = '⏳ Квиз запущен...';
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Запускаем startQuiz...');
                try {
                    await (0,_quizHandler_js__WEBPACK_IMPORTED_MODULE_8__.startQuiz)();
                    quizButton.textContent = '✔️ Квиз завершен';
                    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('startQuiz завершил работу.');
                } catch (error) {
                    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Ошибка во время выполнения startQuiz:', error);
                    quizButton.textContent = '❌ Ошибка квиза';
                    alert(`Произошла ошибка во время квиза: ${error.message || 'См. консоль.'}`);
                } finally {

                }
            });

            container.prepend(quizButton);
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Авто-Квиз button added.');
        } else {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Авто-Квиз button already exists.');
        }
    } else {
         (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Quiz header container ('${buttonContainerSelector}') not found after waiting.`);
    }
};

const initMinePage = async () => {
    const mineButtonSelector = '.main-mine__game-tap';
    const mineButton = await (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.waitForElements)(mineButtonSelector, 5000, true);
    const counterId = 'auto-mine-counter';

    if (!mineButton) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Mine button ('${mineButtonSelector}') not found after waiting.`);
        return;
    }
     if (document.getElementById(counterId)) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Mine counter ('#${counterId}') already exists.`);
        return; 
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Initializing mine page (Burst Mode)...');

    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
    const hitsCount = settings.mineHitCount;

    const counterElement = document.createElement('div');
    counterElement.id = counterId;
    counterElement.textContent = `Удар x${hitsCount}`;
    counterElement.style.textAlign = 'center';
    counterElement.style.marginTop = '10px';
    counterElement.style.fontSize = '14px';
    counterElement.style.fontWeight = 'bold';
    counterElement.style.color = '#FFF';
    counterElement.style.textShadow = '1px 1px 2px black';
    counterElement.style.minHeight = '1.2em'; 

    mineButton.parentNode.insertBefore(counterElement, mineButton.nextSibling);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Mine counter element added.');

    let isMining = false;

    const updateButtonState = (disabled) => {
        mineButton.disabled = disabled;
        mineButton.style.opacity = disabled ? '0.6' : '1';
        mineButton.style.cursor = disabled ? 'wait' : 'pointer';
        isMining = disabled;
    };

    const updateCounter = (current, max, message = null) => {
        if (message) {
            counterElement.textContent = message;
        } else {
            counterElement.textContent = `Статус: ${current}/${max}`;
        }
    };

    mineButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isMining) { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Mining process already running.'); return; }
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { alert('Контекст расширения недействителен.'); return; }
        if (!_api_js__WEBPACK_IMPORTED_MODULE_2__.csrfToken) { alert('CSRF токен не найден.'); (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Mining start blocked: CSRF token is null or empty.'); return; }

        const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
        const currentHitsCount = currentSettings.mineHitCount;

        updateButtonState(true);
        updateCounter(0, currentHitsCount, `Отправка ${currentHitsCount} ударов...`);
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Starting mining burst from button click...');

        try {
            await (0,_mineHandler_js__WEBPACK_IMPORTED_MODULE_9__.startMiningProcess)(updateButtonState, updateCounter);
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('startMiningProcess (burst) finished.');
        } catch (error) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Critical error during startMiningProcess (burst) execution:', error);
            updateButtonState(false);
            updateCounter(0, currentHitsCount, '❌ Критическая ошибка');
            alert(`Произошла критическая ошибка во время добычи: ${error.message || 'См. консоль.'}`);
        }
    });

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Mine button click handler (burst mode) set.');
};


const initPage = async () => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Extension context is not valid. Aborting initialization.');
        return;
    }
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Starting page initialization...');

    (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_4__.addExtensionSettingsButton)();

    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Settings loaded in initPage:', settings);

    if (!settings.extensionEnabled) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Extension is globally disabled via settings. Initialization stopped.');
        cleanupExtensionFeatures();
        return;
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Extension is enabled, proceeding with initialization.');
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    if (token) {
        (0,_api_js__WEBPACK_IMPORTED_MODULE_2__.setCsrfToken)(token);
    } else {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('CSRF token meta tag not found!');
    }

    const context = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__.getCurrentContext)();
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Current context detected:', context);

    if (context === 'quizPage') {
         (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Context is quizPage, calling addQuizButton...');
         await addQuizButton();
    } else if (context === 'minePage') {
         (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Context is minePage, calling initMinePage...');
         await initMinePage();
    }

    if (!context) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('No specific context detected. Initialization finished.');
        return;
    }

    if (context !== 'quizPage' && context !== 'minePage') {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Initializing context: ${context}`);
        let effectiveInitialContextState = {};
        try {
            const { userContextStates } = await chrome.storage.sync.get(['userContextStates']);
            const savedStates = userContextStates || {};
            effectiveInitialContextState = {
                ...(_config_js__WEBPACK_IMPORTED_MODULE_0__.initialContextState[context] || {}),
                ...(savedStates[context] || {})
            };
            contextState = { ...contextState, [context]: { ...effectiveInitialContextState } };
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Current global contextState after init:`, contextState);

            try {
                 switch (context) {
                      case 'userCards': await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initUserCards)(); break;
                      case 'marketCreate':
                          await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, '.card-filter-form__lock-status', 'card-filter-form__lock');
                          await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.handleMarketCreatePage)();
                          break;
                      case 'trade':
                          if (settings.alwaysShowWishlist || contextState[context]?.wishlist || settings.alwaysShowOwners || contextState[context]?.owners) {
                              _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors.trade);
                              await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)('trade', settings);
                          }
                          break;
                      case 'pack': await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initPackPage)(); break;
                      case 'deckView':
                         if (settings.alwaysShowWishlist || contextState[context]?.wishlist || settings.alwaysShowOwners || contextState[context]?.owners) {
                            _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors.deckView);
                            await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)('deckView', settings);
                         }
                         break;
                      case 'tradeOffer': await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, '.trade__rank-wrapper .trade__rank', 'trade__type-card-button'); break;
                      case 'remelt':
                      case 'market':
                      case 'split':
                      case 'deckCreate':
                      case 'marketRequestCreate':
                          await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, '.card-filter-form__lock-status', 'card-filter-form__lock');
                          break;
                      case 'marketRequestView':
                         if (settings.alwaysShowWishlist || contextState[context]?.wishlist || settings.alwaysShowOwners || contextState[context]?.owners) {
                             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Processing cards for ${context}`);
                             _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors[context]);
                             await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)(context, settings);
                         }
                         break;
                      default: (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`No specific initialization logic for context: ${context}`);
                 }
            } catch (error) { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)(`Error during context initialization for ${context}:`, error); }

            initializeObserver(context);

            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Page initialization finished for context:', context);
        } catch (storageError) {
             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Failed to load settings or userContextStates during initPage:', storageError);
             contextState = { ...contextState, [context]: { ...(_config_js__WEBPACK_IMPORTED_MODULE_0__.initialContextState[context] || {}) } };
             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Initialized ${context} with default state due to storage error.`);
             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Current global contextState after storage error:`, contextState);
        }
    } else {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Initialization for context '${context}' finished (added buttons/elements).`);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Received message, but extension context is invalid.'); return false; }
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Received message: ${message.action}`, message);

    if (message.action === 'clearWishlistCache') {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Processing clearWishlistCache message...');
        _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.clear();
        _api_js__WEBPACK_IMPORTED_MODULE_2__.pendingRequests.clear();
        (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)().then(settings => {
            if (settings.extensionEnabled) {
                const context = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__.getCurrentContext)();
                if (context && _config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors[context] && context !== 'quizPage' && context !== 'minePage') {
                   const oldLabels = document.querySelectorAll('.wishlist-warning, .owners-count');
                   oldLabels.forEach(label => label.remove());
                   (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Removed ${oldLabels.length} old labels.`);
                   (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Reprocessing context after cache clear...');
                   const currentState = contextState[context] || {};
                   const effectiveState = { ...(_config_js__WEBPACK_IMPORTED_MODULE_0__.initialContextState[context] || {}), ...currentState };
                   contextState = { ...contextState, [context]: effectiveState };
                   if (context === 'userCards') { (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initUserCards)(); }
                   else if (['tradeOffer', 'remelt', 'market', 'split', 'deckCreate', 'marketCreate', 'marketRequestCreate'].includes(context)) {
                      const buttonConfigMap = {
                         'tradeOffer': { selector: '.trade__rank-wrapper .trade__rank', class: 'trade__type-card-button' },
                         'remelt': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'market': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'split': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'deckCreate': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'marketCreate': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'marketRequestCreate': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                      };
                      const buttonConfig = buttonConfigMap[context];
                      if (buttonConfig) { (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, buttonConfig.selector, buttonConfig.class); }
                      else { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Button config not found for ${context}...`); (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)(context, settings); }
                   } else if (context === 'pack') { (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initPackPage)(); }
                   else if (context === 'trade' || context === 'deckView' || context === 'marketRequestView') {
                        _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors[context]);
                        (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)(context, settings);
                   }
                   else { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Unhandled context ${context} in clear cache reprocessing.`); }
                } else {
                    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`No active context requiring card reprocessing after cache clear. Current context: ${context}`);
                }
            } else {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Cache cleared, but extension is globally disabled. No reprocessing needed.');
                 const oldLabels = document.querySelectorAll('.wishlist-warning, .owners-count');
                 oldLabels.forEach(label => label.remove());
            }
        }).catch(error => (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Error getting settings during cache clear:', error));
        sendResponse({ status: 'cache_cleared_on_page' });
        return true;
    } else {
          sendResponse({ status: 'unknown_action_on_page', received: message.action });
    }
    return true;
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'sync') {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Detected change in sync settings:', changes);
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Settings changed, but context invalid...'); return; }

        if (changes.extensionEnabled) {
            const newValue = changes.extensionEnabled.newValue;
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Global enable switch changed to: ${newValue}`);
            if (newValue) {
                await initPage();
            } else {
                cleanupExtensionFeatures();
            }
        } else {
            const changedKeys = Object.keys(changes);
            const relevantKeys = ['wishlistStyle', 'wishlistWarning', 'alwaysShowWishlist', 'alwaysShowOwners', 'userContextStates', 'mineHitCount'];
            const otherSettingsChanged = changedKeys.some(key => relevantKeys.includes(key));

            if (otherSettingsChanged) {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Detected change in other relevant sync settings.');
                 const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
                 if (settings.extensionEnabled) {
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Extension is enabled, re-initializing due to setting change.');
                     await initPage();
                 } else {
                      (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Other settings changed, but extension is disabled. No action needed.');
                 }
            }
        }
    }
});

/***/ }),

/***/ "./mineHandler.js":
/*!************************!*\
  !*** ./mineHandler.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   startMiningProcess: () => (/* binding */ startMiningProcess)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api.js */ "./api.js");
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./settings.js */ "./settings.js");


 

const MINE_HIT_URL = "https://mangabuff.ru/mine/hit";

const sendMineHitRequest = async () => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error("Extension context lost");
    if (!_api_js__WEBPACK_IMPORTED_MODULE_1__.csrfToken) throw new Error("CSRF token is missing");
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'mineHit',
            url: MINE_HIT_URL,
            csrfToken: _api_js__WEBPACK_IMPORTED_MODULE_1__.csrfToken
        });
        if (!response) { throw new Error(`No response received...`); }
        if (!response.success) {
            const error = new Error(response.error || 'Unknown background error');
            error.status = response.status;
            error.data = response.data;
            throw error;
        }
        return response.data;
    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error sending message for action mineHit:`, error);
        throw error;
    }
};

const startMiningProcess = async (updateButtonStateCallback, updateCounterCallback) => {

    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_2__.getSettings)();
    const hitsToSend = settings.mineHitCount; 

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`🚀 Starting mining burst of ${hitsToSend} hits...`);

    updateCounterCallback(0, hitsToSend, `Отправка ${hitsToSend} ударов...`);
    updateButtonStateCallback(true);

    const hitPromises = [];
    for (let i = 0; i < hitsToSend; i++) { 
        hitPromises.push(sendMineHitRequest());
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Initiated ${hitPromises.length} hit requests.`);

    const results = await Promise.allSettled(hitPromises);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Finished processing all ${results.length} hit requests.`);

    let successfulHits = 0;
    let firstErrorMessage = null;
    let rateLimitHit = false;

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            successfulHits++;
        } else {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`❌ Hit ${index + 1} failed. Reason:`, result.reason?.message || result.reason);
            if (!firstErrorMessage) {
                firstErrorMessage = result.reason?.message || 'Неизвестная ошибка';
            }
            if (result.reason?.status === 403 || result.reason?.status === 429 || result.reason?.message?.includes('closed') || result.reason?.message?.includes('закрыта')) {
                 rateLimitHit = true;
            }
        }
    });

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`📊 Mining burst result: ${successfulHits} successful / ${hitsToSend - successfulHits} failed.`); 

    let finalMessage = '';
    if (successfulHits === hitsToSend) { 
        finalMessage = `✔️ Успешно (${successfulHits}/${hitsToSend})`; 
    } else if (rateLimitHit) {
        finalMessage = `❌ Шахта закрыта (${successfulHits}/${hitsToSend})`; 
    } else if (successfulHits > 0) {
        finalMessage = `⚠️ Частично (${successfulHits}/${hitsToSend}). Ошибка: ${firstErrorMessage}`; 
    } else {
        finalMessage = `❌ Ошибка (${successfulHits}/${hitsToSend}): ${firstErrorMessage}`; 
    }

    updateButtonStateCallback(false);
    updateCounterCallback(successfulHits, hitsToSend, finalMessage); 
};

/***/ }),

/***/ "./observer.js":
/*!*********************!*\
  !*** ./observer.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setupObserver: () => (/* binding */ setupObserver)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./settings.js */ "./settings.js");
/* harmony import */ var _cardProcessor_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./cardProcessor.js */ "./cardProcessor.js");
/* harmony import */ var _contextHandlers_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./contextHandlers.js */ "./contextHandlers.js");
/* harmony import */ var _main_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./main.js */ "./main.js");







const setupObserver = (context, observerCreatedCallback) => {
  if (!context || !_config_js__WEBPACK_IMPORTED_MODULE_1__.contextsSelectors[context]) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: Not set up - invalid context or no selector defined: ${context}`);
    return;
  }

  let targetSelector;
  switch (context) {
      case 'tradeOffer': targetSelector = '.trade__inventory-list'; break;
      case 'pack': return;
      case 'deckView': targetSelector = '.deck__items'; break;
      case 'userCards': targetSelector = '.manga-cards'; break;
      case 'trade': targetSelector = '.trade__main'; break;
      case 'remelt':
      case 'market':
      case 'split':
      case 'deckCreate':
      case 'marketCreate':
      case 'marketRequestCreate': targetSelector = '.card-filter-list__items'; break;
      default:
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: No target selector defined for context ${context}.`);
          return;
  }

  const targetNode = document.querySelector(targetSelector);
  if (!targetNode) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: Target node not found with selector: ${targetSelector} for context ${context}`);
      setTimeout(() => {
          const delayedNode = document.querySelector(targetSelector);
          if (delayedNode) {
              (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Target node ${targetSelector} found after delay. Setting up observer.`);
              observeNode(delayedNode, context, observerCreatedCallback);
          } else {
              (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: Target node ${targetSelector} still not found after delay.`);
          }
      }, 1000);
      return;
  }

  observeNode(targetNode, context, observerCreatedCallback);
};

const observeNode = (targetNode, context, observerCreatedCallback) => {
    const observerCallback = (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.debounce)(async (mutations) => {
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)('Observer: Extension context lost, skipping mutation processing.');
            return;
        }

        let cardListChanged = false;
        const cardSelector = _config_js__WEBPACK_IMPORTED_MODULE_1__.contextsSelectors[context];

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const addedNodesMatch = Array.from(mutation.addedNodes).some(node => node.matches?.(cardSelector));
                const removedNodesMatch = Array.from(mutation.removedNodes).some(node => node.matches?.(cardSelector));

                if (addedNodesMatch || removedNodesMatch) {
                    cardListChanged = true;
                    break;
                }
                if (context === 'userCards' && (mutation.target === targetNode || mutation.target.closest(targetSelector))) {
                     if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                         cardListChanged = true;
                         break;
                     }
                }
                 if (context === 'trade' && mutation.target === targetNode) {
                     if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                         cardListChanged = true;
                         break;
                     }
                 }
            }
        }

        if (cardListChanged) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Detected card list change in context: ${context}. Reprocessing.`);
            const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_2__.getSettings)();

            if (context === 'userCards') {
                await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_4__.initUserCards)();
            }

            const needsProcessing = (_main_js__WEBPACK_IMPORTED_MODULE_5__.contextState[context]?.wishlist || currentSettings.alwaysShowWishlist)
                                 || (_main_js__WEBPACK_IMPORTED_MODULE_5__.contextState[context]?.owners || currentSettings.alwaysShowOwners);

            if (needsProcessing) {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Reprocessing cards for ${context} as labels are active.`);
                _utils_js__WEBPACK_IMPORTED_MODULE_0__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_1__.contextsSelectors[context]);
                await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_3__.processCards)(context, currentSettings);
            } else {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Card list changed, but no labels are active for context ${context}. No reprocessing needed.`);
                const oldLabels = targetNode.querySelectorAll('.wishlist-warning, .owners-count');
                oldLabels.forEach(label => label.remove());
            }
        }
    }, 750);

    const observer = new MutationObserver(observerCallback);
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
    });

    if (typeof observerCreatedCallback === 'function') {
        observerCreatedCallback(observer);
    }
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Setup observer for context ${context} on target: ${targetSelector}`);
}

/***/ }),

/***/ "./quizHandler.js":
/*!************************!*\
  !*** ./quizHandler.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   startQuiz: () => (/* binding */ startQuiz)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api.js */ "./api.js");

 

const MAX_ANSWERS = 15;
let answerCount = 0;
let answeredQuestions = {}; 

const sendQuizRequest = async (action, data = {}) => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error("Extension context lost");
    try {
        const response = await chrome.runtime.sendMessage({ action, ...data, csrfToken: _api_js__WEBPACK_IMPORTED_MODULE_1__.csrfToken });
        if (!response) {
            throw new Error(`No response received from background for action: ${action}`);
        }
        if (!response.success) {
            throw new Error(`Background action ${action} failed: ${response.error || 'Unknown error'}`);
        }
        return response.data; 
    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error sending message for action ${action}:`, error);
        throw error; 
    }
};

async function processQuestion(question) {
    if (!question || !question.id) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)("Received invalid question data:", question);
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("🏁 Quiz finished due to invalid question data.");
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("Final log:", answeredQuestions);
        return;
    }

    if (answerCount >= MAX_ANSWERS) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("🏁 Reached MAX_ANSWERS limit. Final log:");
        console.log(answeredQuestions);
        return;
    }

    const qid = question.id;

    if (answeredQuestions[qid]) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`⚠️ Duplicate question ID ${qid} skipped.`);
        return; 
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`📡 Question #${answerCount + 1} (ID: ${qid}): ${question.question}`);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("📋 Options:", question.answers);

    answeredQuestions[qid] = {
        question: question.question,
        answers: question.answers,
        correct_text: question.correct_text
    };

    const answer = question.correct_text;
    if (answer === undefined || answer === null) {
         (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`❌ Correct answer (correct_text) not found for question ID ${qid}. Stopping quiz.`, question);
         (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("Final log:", answeredQuestions);
         return;
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`💡 Correct answer identified: "${answer}"`);

    try {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`📤 Sending answer for question ID ${qid}...`);
        const res = await sendQuizRequest('quizAnswer', { answer: answer });
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`✅ Answer accepted: Status=${res.status}, Msg=${res.message}, CorrectCount=${res.correct_count}`);

        answerCount++;

        if (res.question && answerCount < MAX_ANSWERS) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`⏱️ Waiting before next question...`);
            setTimeout(() => processQuestion(res.question), 0); 
        } else {
            if (!res.question) (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("🏁 No more questions received from server.");
            if (answerCount >= MAX_ANSWERS) (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("🏁 Reached MAX_ANSWERS limit.");
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("Final log:", answeredQuestions);
        }
    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`❌ Error sending answer or processing response for question ID ${qid}:`, error);
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("🏁 Quiz stopped due to error.");
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("Final log:", answeredQuestions);
    }
}

const startQuiz = async () => {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)('🚀 Starting Quiz...');
    answerCount = 0;
    answeredQuestions = {};
    try {
        const res = await sendQuizRequest('quizStart');
        if (res && res.question) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("🎉 Quiz started successfully! Processing first question.");
            processQuestion(res.question);
        } else {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)("❌ Failed to start quiz or receive the first question.", res);
        }
    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)("❌ Failed to initiate quiz start:", error);
    }
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)("✅ Quiz initiation attempt finished!");
};

/***/ }),

/***/ "./settings.js":
/*!*********************!*\
  !*** ./settings.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSettings: () => (/* binding */ getSettings)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");


const defaultSettings = {
  extensionEnabled: true,
  wishlistWarning: 10,
  wishlistStyle: 'style-1',
  alwaysShowWishlist: false,
  alwaysShowOwners: false,
  mineHitCount: 100
};

const getSettings = async () => {
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) {
    return Promise.resolve({ ...defaultSettings });
  }
  try {
    const settings = await chrome.storage.sync.get(Object.keys(defaultSettings));
    const mergedSettings = { ...defaultSettings, ...settings };
    return mergedSettings;
  } catch (error) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)('Failed to load settings from storage:', error);
    return { ...defaultSettings };
  }
};

/***/ }),

/***/ "./utils.js":
/*!******************!*\
  !*** ./utils.js ***!
  \******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cachedElements: () => (/* binding */ cachedElements),
/* harmony export */   debounce: () => (/* binding */ debounce),
/* harmony export */   getElements: () => (/* binding */ getElements),
/* harmony export */   isExtensionContextValid: () => (/* binding */ isExtensionContextValid),
/* harmony export */   log: () => (/* binding */ log),
/* harmony export */   logError: () => (/* binding */ logError),
/* harmony export */   logWarn: () => (/* binding */ logWarn),
/* harmony export */   waitForElements: () => (/* binding */ waitForElements)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config.js */ "./config.js");


const cachedElements = new Map();

const log = (message, ...args) => console.log(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, ...args);
const logWarn = (message, ...args) => console.warn(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, ...args);
const logError = (message, ...args) => console.error(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, ...args);

const isExtensionContextValid = () => {
  try {
    return !!chrome.runtime.id;
  } catch (e) {
    logError(`Extension context invalidated:`, e);
    return false;
  }
};

const getElements = (selector) => {
    const dynamicSelectors = [
        '.trade__inventory-item',
        '.card-filter-list__card',
        '.trade__main-item',
        '.lootbox__card', 
        '.deck__item'
    ];
    if (!cachedElements.has(selector) || dynamicSelectors.includes(selector)) {
        const elements = Array.from(document.querySelectorAll(selector));
        cachedElements.set(selector, elements);
    }
    return cachedElements.get(selector) || []; 
};

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(undefined, args), wait);
  };
};

const waitForElements = (selector, timeout, single = false) => {
  return new Promise(resolve => {
    let intervalId;
    const timerId = setTimeout(() => {
      clearInterval(intervalId);
      logWarn(`Timeout waiting for ${selector}`);
      resolve(single ? null : []);
    }, timeout);

    intervalId = setInterval(() => {
      const elements = single ? document.querySelector(selector) : Array.from(document.querySelectorAll(selector));
      if ((single && elements) || (!single && elements.length > 0)) {
        clearInterval(intervalId);
        clearTimeout(timerId);
        log(`Found ${single ? 'element' : elements.length + ' elements'} for ${selector}`);
        resolve(elements);
      }
    }, 100);
  });
};

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./main.js");
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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b0RBQW9ELE1BQU0sU0FBUztBQUN4RjtBQUNBO0FBQ0EsS0FBSztBQUNMLEdBQUc7QUFDSDs7Ozs7O1VDM0RBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7O1VBRUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7Ozs7O1dDdEJBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EseUNBQXlDLHdDQUF3QztXQUNqRjtXQUNBO1dBQ0E7Ozs7O1dDUEE7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0EsdURBQXVELGlCQUFpQjtXQUN4RTtXQUNBLGdEQUFnRCxhQUFhO1dBQzdEOzs7OztVRU5BO1VBQ0E7VUFDQTtVQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi8uL2FwaS5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vY2FyZFByb2Nlc3Nvci5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vY29uZmlnLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9jb250ZXh0SGFuZGxlcnMuanMiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi8uL2RvbVV0aWxzLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9tYWluLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9taW5lSGFuZGxlci5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vb2JzZXJ2ZXIuanMiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi8uL3F1aXpIYW5kbGVyLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9zZXR0aW5ncy5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vdXRpbHMuanMiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vd2VicGFjay9iZWZvcmUtc3RhcnR1cCIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uL3dlYnBhY2svc3RhcnR1cCIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uL3dlYnBhY2svYWZ0ZXItc3RhcnR1cCJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBhcGkuanMgKNChINCe0J/QotCY0JzQmNCX0JDQptCY0JXQmSDQn9CeINCf0JDQk9CY0J3QkNCm0JjQmClcclxuaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGxvZywgbG9nV2FybiwgbG9nRXJyb3IgfSBmcm9tICcuL3V0aWxzLmpzJztcclxuaW1wb3J0IHsgTUFYX0NPTkNVUlJFTlRfUkVRVUVTVFMgfSBmcm9tICcuL2NvbmZpZy5qcyc7XHJcblxyXG5leHBvcnQgY29uc3QgcGVuZGluZ1JlcXVlc3RzID0gbmV3IE1hcCgpO1xyXG5leHBvcnQgbGV0IGFjdGl2ZVJlcXVlc3RzID0gMDtcclxuZXhwb3J0IGxldCBjc3JmVG9rZW4gPSBudWxsO1xyXG5cclxuZXhwb3J0IGNvbnN0IHNldENzcmZUb2tlbiA9ICh0b2tlbikgPT4ge1xyXG4gICAgY3NyZlRva2VuID0gdG9rZW47XHJcbn1cclxuXHJcbmNvbnN0IGdldExhc3RQYWdlTnVtYmVyID0gKGRvYykgPT4ge1xyXG4gICAgY29uc3QgcGFnaW5hdGlvbkJ1dHRvbnMgPSBkb2MucXVlcnlTZWxlY3RvckFsbCgndWwucGFnaW5hdGlvbiBsaS5wYWdpbmF0aW9uX19idXR0b24gYVtocmVmKj1cInBhZ2U9XCJdJyk7XHJcbiAgICBsZXQgbWF4UGFnZSA9IDE7XHJcbiAgICBwYWdpbmF0aW9uQnV0dG9ucy5mb3JFYWNoKGxpbmsgPT4ge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IGxpbmsuZ2V0QXR0cmlidXRlKCdocmVmJyk7XHJcbiAgICAgICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL3BhZ2U9KFxcZCspLyk7XHJcbiAgICAgICAgaWYgKG1hdGNoICYmIG1hdGNoWzFdKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhZ2VOdW0gPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xyXG4gICAgICAgICAgICBpZiAoIWlzTmFOKHBhZ2VOdW0pICYmIHBhZ2VOdW0gPiBtYXhQYWdlKSB7XHJcbiAgICAgICAgICAgICAgICBtYXhQYWdlID0gcGFnZU51bTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG1heFBhZ2U7XHJcbn07XHJcblxyXG5jb25zdCBjb3VudEl0ZW1zT25QYWdlID0gKGRvYywgdHlwZSkgPT4ge1xyXG4gICAgY29uc3Qgc2VsZWN0b3IgPSB0eXBlID09PSAnd2lzaGxpc3QnID8gJy5wcm9maWxlX19mcmllbmRzLWl0ZW0nIDogJy5jYXJkLXNob3dfX293bmVyJztcclxuICAgIHJldHVybiBkb2MucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikubGVuZ3RoO1xyXG59O1xyXG5cclxuY29uc3QgZ2V0VXNlckNvdW50ID0gYXN5bmMgKHR5cGUsIGNhcmRJZCwgcmV0cmllcyA9IDIpID0+IHtcclxuICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHJldHVybiAwO1xyXG5cclxuICBjb25zdCBjYWNoZUtleSA9IGAke3R5cGV9XyR7Y2FyZElkfWA7XHJcbiAgaWYgKCFjc3JmVG9rZW4pIHtcclxuICAgICAgY3NyZlRva2VuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPVwiY3NyZi10b2tlblwiXScpPy5nZXRBdHRyaWJ1dGUoJ2NvbnRlbnQnKSB8fCAnJztcclxuICB9XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBjYWNoZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoW2NhY2hlS2V5XSkudGhlbihyID0+IHJbY2FjaGVLZXldKTtcclxuICAgIGlmIChjYWNoZWQgJiYgRGF0ZS5ub3coKSAtIGNhY2hlZC50aW1lc3RhbXAgPCAyNCAqIDYwICogNjAgKiAxMDAwKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZWQuY291bnQ7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgbG9nRXJyb3IoYEVycm9yIGFjY2Vzc2luZyBsb2NhbCBzdG9yYWdlIGZvciBjYWNoZSBrZXkgJHtjYWNoZUtleX06YCwgZXJyb3IpO1xyXG4gIH1cclxuXHJcbiAgaWYgKHBlbmRpbmdSZXF1ZXN0cy5oYXMoY2FjaGVLZXkpKSB7XHJcbiAgICByZXR1cm4gcGVuZGluZ1JlcXVlc3RzLmdldChjYWNoZUtleSk7XHJcbiAgfVxyXG5cclxuICBsb2coYEdldHRpbmcgT1BUSU1JWkVEICR7dHlwZX0gY291bnQgZm9yIGNhcmQgJHtjYXJkSWR9YCk7XHJcbiAgY29uc3QgcmVxdWVzdFByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xyXG4gICAgd2hpbGUgKGFjdGl2ZVJlcXVlc3RzID49IE1BWF9DT05DVVJSRU5UX1JFUVVFU1RTKSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xyXG4gICAgfVxyXG4gICAgYWN0aXZlUmVxdWVzdHMrKztcclxuXHJcbiAgICBsZXQgdG90YWwgPSAwOyBcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgdGhyb3cgbmV3IEVycm9yKCdFeHRlbnNpb24gY29udGV4dCBsb3N0IGJlZm9yZSBmaXJzdCBwYWdlIGZldGNoJyk7XHJcblxyXG4gICAgICAgIGxldCByZXNwb25zZVBhZ2UxID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICBhY3Rpb246IGBmZXRjaCR7dHlwZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHR5cGUuc2xpY2UoMSl9Q291bnRgLFxyXG4gICAgICAgICAgICBjYXJkSWQsXHJcbiAgICAgICAgICAgIHBhZ2U6IDEsIFxyXG4gICAgICAgICAgICBjc3JmVG9rZW5cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCFyZXNwb25zZVBhZ2UxIHx8ICFyZXNwb25zZVBhZ2UxLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlUGFnZTEudGV4dCkge1xyXG4gICAgICAgICAgICBpZiAocmVzcG9uc2VQYWdlMT8uZXJyb3I/LmluY2x1ZGVzKCc0MDQnKSkge1xyXG4gICAgICAgICAgICAgICAgIGxvZyhgQ2FyZCAke2NhcmRJZH0gbm90IGZvdW5kIGZvciAke3R5cGV9ICg0MDQgb24gcGFnZSAxKS4gQ291bnQgaXMgMC5gKTtcclxuICAgICAgICAgICAgICAgICB0b3RhbCA9IDA7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsb2dXYXJuKGBGYWlsZWQgdG8gZmV0Y2ggcGFnZSAxIGZvciAke3R5cGV9IGNvdW50LCBjYXJkICR7Y2FyZElkfTpgLCByZXNwb25zZVBhZ2UxPy5lcnJvciB8fCAnTm8gcmVzcG9uc2Ugb3IgdGV4dCcpO1xyXG4gICAgICAgICAgICAgICAgIGlmIChyZXRyaWVzID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICBsb2dXYXJuKGBSZXRyeWluZyBmZXRjaCBmb3IgY2FyZCAke2NhcmRJZH0gKHBhZ2UgMSksIHJldHJpZXMgbGVmdDogJHtyZXRyaWVzIC0gMX1gKTtcclxuICAgICAgICAgICAgICAgICAgICAgYWN0aXZlUmVxdWVzdHMtLTtcclxuICAgICAgICAgICAgICAgICAgICAgcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShjYWNoZUtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRVc2VyQ291bnQodHlwZSwgY2FyZElkLCByZXRyaWVzIC0gMSk7IFxyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmZXRjaCBwYWdlIDEgYWZ0ZXIgcmV0cmllcyBmb3IgY2FyZCAke2NhcmRJZH1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRvY1BhZ2UxID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhyZXNwb25zZVBhZ2UxLnRleHQsICd0ZXh0L2h0bWwnKTtcclxuICAgICAgICAgICAgY29uc3QgY291bnRQZXJQYWdlID0gY291bnRJdGVtc09uUGFnZShkb2NQYWdlMSwgdHlwZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhc3RQYWdlTnVtID0gZ2V0TGFzdFBhZ2VOdW1iZXIoZG9jUGFnZTEpO1xyXG4gICAgICAgICAgICBsb2coYFBhZ2UgMSBmZXRjaGVkOiBjb3VudFBlclBhZ2U9JHtjb3VudFBlclBhZ2V9LCBsYXN0UGFnZU51bT0ke2xhc3RQYWdlTnVtfWApO1xyXG5cclxuICAgICAgICAgICAgaWYgKGxhc3RQYWdlTnVtIDw9IDEpIHtcclxuICAgICAgICAgICAgICAgIHRvdGFsID0gY291bnRQZXJQYWdlO1xyXG4gICAgICAgICAgICAgICAgbG9nKGBPbmx5IG9uZSBwYWdlIGZvdW5kLiBUb3RhbCAke3R5cGV9IGNvdW50OiAke3RvdGFsfWApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB0aHJvdyBuZXcgRXJyb3IoJ0V4dGVuc2lvbiBjb250ZXh0IGxvc3QgYmVmb3JlIGxhc3QgcGFnZSBmZXRjaCcpO1xyXG5cclxuICAgICAgICAgICAgICAgICBsb2coYEZldGNoaW5nIGxhc3QgcGFnZSAoJHtsYXN0UGFnZU51bX0pIGZvciBjYXJkICR7Y2FyZElkfWApO1xyXG4gICAgICAgICAgICAgICAgIGxldCByZXNwb25zZUxhc3RQYWdlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICAgICAgICAgICBhY3Rpb246IGBmZXRjaCR7dHlwZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHR5cGUuc2xpY2UoMSl9Q291bnRgLFxyXG4gICAgICAgICAgICAgICAgICAgICBjYXJkSWQsXHJcbiAgICAgICAgICAgICAgICAgICAgIHBhZ2U6IGxhc3RQYWdlTnVtLCBcclxuICAgICAgICAgICAgICAgICAgICAgY3NyZlRva2VuXHJcbiAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2VMYXN0UGFnZSB8fCAhcmVzcG9uc2VMYXN0UGFnZS5zdWNjZXNzIHx8ICFyZXNwb25zZUxhc3RQYWdlLnRleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgbG9nV2FybihgRmFpbGVkIHRvIGZldGNoIGxhc3QgcGFnZSAoJHtsYXN0UGFnZU51bX0pIGZvciAke3R5cGV9IGNvdW50LCBjYXJkICR7Y2FyZElkfTpgLCByZXNwb25zZUxhc3RQYWdlPy5lcnJvciB8fCAnTm8gcmVzcG9uc2Ugb3IgdGV4dCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgdG90YWwgPSAwOyBcclxuICAgICAgICAgICAgICAgICAgICAgIGxvZ1dhcm4oYENvdWxkIG5vdCBjYWxjdWxhdGUgdG90YWwgY291bnQgYWNjdXJhdGVseSBkdWUgdG8gbGFzdCBwYWdlIGZldGNoIGVycm9yLmApO1xyXG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRvY0xhc3RQYWdlID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhyZXNwb25zZUxhc3RQYWdlLnRleHQsICd0ZXh0L2h0bWwnKTtcclxuICAgICAgICAgICAgICAgICAgICAgY29uc3QgY291bnRPbkxhc3RQYWdlID0gY291bnRJdGVtc09uUGFnZShkb2NMYXN0UGFnZSwgdHlwZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgIGxvZyhgTGFzdCBwYWdlICgke2xhc3RQYWdlTnVtfSkgZmV0Y2hlZDogY291bnRPbkxhc3RQYWdlPSR7Y291bnRPbkxhc3RQYWdlfWApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgdG90YWwgPSAoY291bnRQZXJQYWdlICogKGxhc3RQYWdlTnVtIC0gMSkpICsgY291bnRPbkxhc3RQYWdlO1xyXG4gICAgICAgICAgICAgICAgICAgICBsb2coYENhbGN1bGF0ZWQgdG90YWwgJHt0eXBlfSBjb3VudDogKCR7Y291bnRQZXJQYWdlfSAqICR7bGFzdFBhZ2VOdW0gLSAxfSkgKyAke2NvdW50T25MYXN0UGFnZX0gPSAke3RvdGFsfWApO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgIGlmIChpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpICYmIHRvdGFsID49IDApIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IFtjYWNoZUtleV06IHsgY291bnQ6IHRvdGFsLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSB9KTtcclxuICAgICAgICAgICAgbG9nKGBGZXRjaGVkIChPcHRpbWl6ZWQpIGFuZCBjYWNoZWQgJHt0eXBlfSBjb3VudCBmb3IgY2FyZCAke2NhcmRJZH06ICR7dG90YWx9YCk7XHJcbiAgICAgICAgICB9IGNhdGNoIChzdG9yYWdlRXJyb3IpIHtcclxuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHNldHRpbmcgbG9jYWwgc3RvcmFnZSBmb3IgY2FjaGUga2V5ICR7Y2FjaGVLZXl9OmAsIHN0b3JhZ2VFcnJvcik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAodG90YWwgPCAwKSB7XHJcbiAgICAgICAgICBsb2dXYXJuKGBGZXRjaCByZXN1bHRlZCBpbiBpbnZhbGlkIGNvdW50ICgke3RvdGFsfSkgZm9yICR7dHlwZX0sIGNhcmQgJHtjYXJkSWR9LiBOb3QgY2FjaGluZy5gKTtcclxuICAgICAgICAgIHRvdGFsID0gMDsgXHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRvdGFsOyBcclxuXHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGxvZ0Vycm9yKGBVbmhhbmRsZWQgZXJyb3IgZHVyaW5nIE9QVElNSVpFRCAke3R5cGV9IGNvdW50IGZldGNoIGZvciBjYXJkICR7Y2FyZElkfTpgLCBlcnJvcik7XHJcbiAgICAgICAgaWYgKHJldHJpZXMgPiAwICYmIGVycm9yLm1lc3NhZ2UgIT09ICdFeHRlbnNpb24gY29udGV4dCBsb3N0IGJlZm9yZSBmaXJzdCBwYWdlIGZldGNoJyAmJiBlcnJvci5tZXNzYWdlICE9PSAnRXh0ZW5zaW9uIGNvbnRleHQgbG9zdCBiZWZvcmUgbGFzdCBwYWdlIGZldGNoJykge1xyXG4gICAgICAgICAgICBsb2dXYXJuKGBSZXRyeWluZyBlbnRpcmUgb3B0aW1pemVkIGZldGNoIGZvciBjYXJkICR7Y2FyZElkfSBkdWUgdG8gZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgICAgICAgYWN0aXZlUmVxdWVzdHMtLTtcclxuICAgICAgICAgICAgcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShjYWNoZUtleSk7XHJcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRVc2VyQ291bnQodHlwZSwgY2FyZElkLCByZXRyaWVzIC0gMSk7IFxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gMDsgXHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBhY3RpdmVSZXF1ZXN0cy0tO1xyXG4gICAgICBwZW5kaW5nUmVxdWVzdHMuZGVsZXRlKGNhY2hlS2V5KTtcclxuICAgIH1cclxuICB9KSgpO1xyXG5cclxuICBwZW5kaW5nUmVxdWVzdHMuc2V0KGNhY2hlS2V5LCByZXF1ZXN0UHJvbWlzZSk7XHJcbiAgcmV0dXJuIHJlcXVlc3RQcm9taXNlO1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGdldFdpc2hsaXN0Q291bnQgPSBjYXJkSWQgPT4gZ2V0VXNlckNvdW50KCd3aXNobGlzdCcsIGNhcmRJZCk7XHJcbmV4cG9ydCBjb25zdCBnZXRPd25lcnNDb3VudCA9IGNhcmRJZCA9PiBnZXRVc2VyQ291bnQoJ293bmVycycsIGNhcmRJZCk7IiwiLy8gY2FyZFByb2Nlc3Nvci5qcyAo0JjQodCf0KDQkNCS0JvQldCd0J3Qq9CZIHY0IC0gQWx3YXlzIFNob3cpXHJcbmltcG9ydCB7IGlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkLCBnZXRFbGVtZW50cywgbG9nLCBsb2dXYXJuLCBsb2dFcnJvciB9IGZyb20gJy4vdXRpbHMuanMnO1xyXG5pbXBvcnQgeyBnZXRXaXNobGlzdENvdW50LCBnZXRPd25lcnNDb3VudCB9IGZyb20gJy4vYXBpLmpzJztcclxuaW1wb3J0IHsgYWRkVGV4dExhYmVsIH0gZnJvbSAnLi9kb21VdGlscy5qcyc7XHJcbmltcG9ydCB7IGNvbnRleHRzU2VsZWN0b3JzIH0gZnJvbSAnLi9jb25maWcuanMnO1xyXG5pbXBvcnQgeyBjb250ZXh0U3RhdGUgfSBmcm9tICcuL21haW4uanMnOyBcclxuXHJcbi8vINCe0LHRgNCw0LHQvtGC0LrQsCDQutCw0YDRglxyXG5leHBvcnQgY29uc3QgcHJvY2Vzc0NhcmRzID0gYXN5bmMgKGNvbnRleHQsIHNldHRpbmdzKSA9PiB7IFxyXG4gIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgcmV0dXJuO1xyXG5cclxuICBjb25zdCBzZWxlY3RvciA9IGNvbnRleHRzU2VsZWN0b3JzW2NvbnRleHRdO1xyXG4gIGlmICghc2VsZWN0b3IpIHtcclxuICAgICAgbG9nV2FybihgTm8gc2VsZWN0b3IgZGVmaW5lZCBmb3IgY29udGV4dDogJHtjb250ZXh0fWApO1xyXG4gICAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBjYXJkSXRlbXMgPSBnZXRFbGVtZW50cyhzZWxlY3Rvcik7XHJcbiAgaWYgKCFjYXJkSXRlbXMubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gIGNvbnN0IEJBVENIX1NJWkUgPSAxMDtcclxuXHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYXJkSXRlbXMubGVuZ3RoOyBpICs9IEJBVENIX1NJWkUpIHtcclxuICAgIGNvbnN0IGJhdGNoID0gY2FyZEl0ZW1zLnNsaWNlKGksIGkgKyBCQVRDSF9TSVpFKTtcclxuICAgIGNvbnN0IHByb21pc2VzID0gYmF0Y2gubWFwKGFzeW5jIChpdGVtKSA9PiB7XHJcbiAgICAgIGxldCBjYXJkSWQgPSBudWxsO1xyXG4gICAgICB0cnkgeyBcclxuICAgICAgICBpZiAoY29udGV4dCA9PT0gJ3RyYWRlJykgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKT8ubWF0Y2goL1xcL2NhcmRzXFwvKFxcZCspLyk/LlsxXTtcclxuICAgICAgICBlbHNlIGlmIChjb250ZXh0ID09PSAndHJhZGVPZmZlcicpIGNhcmRJZCA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdkYXRhLWNhcmQtaWQnKTtcclxuICAgICAgICBlbHNlIGlmIChjb250ZXh0ID09PSAncGFjaycpIGNhcmRJZCA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdkYXRhLWlkJyk7XHJcbiAgICAgICAgZWxzZSBpZiAoY29udGV4dCA9PT0gJ2RlY2tWaWV3JykgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2FyZC1pZCcpO1xyXG4gICAgICAgIGVsc2UgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2FyZC1pZCcpIHx8IGl0ZW0uZ2V0QXR0cmlidXRlKCdkYXRhLWlkJyk7XHJcblxyXG4gICAgICAgIGlmICghY2FyZElkKSB7IFxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhcmQgSUQgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChpZEVycm9yKSB7XHJcbiAgICAgICAgICBsb2dXYXJuKGBTa2lwcGluZyBpdGVtIGluICR7Y29udGV4dH0gZHVlIHRvIElEIGVycm9yOmAsIGlkRXJyb3IubWVzc2FnZSwgaXRlbS5vdXRlckhUTUwpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBzaG93V2lzaGxpc3QgPSBzZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgfHwgY29udGV4dFN0YXRlW2NvbnRleHRdPy53aXNobGlzdDtcclxuICAgICAgY29uc3Qgc2hvd093bmVycyA9IHNldHRpbmdzLmFsd2F5c1Nob3dPd25lcnMgfHwgY29udGV4dFN0YXRlW2NvbnRleHRdPy5vd25lcnM7XHJcblxyXG4gICAgICBpZiAoY29udGV4dCA9PT0gJ2RlY2tWaWV3JyB8fCBjb250ZXh0ID09PSAndXNlckNhcmRzJykgeyAvKiAuLi4gKi8gfVxyXG5cclxuICAgICAgaXRlbS5xdWVyeVNlbGVjdG9yKCcud2lzaGxpc3Qtd2FybmluZycpPy5yZW1vdmUoKTtcclxuICAgICAgaXRlbS5xdWVyeVNlbGVjdG9yKCcub3duZXJzLWNvdW50Jyk/LnJlbW92ZSgpO1xyXG5cclxuICAgICAgY29uc3QgdGFza3MgPSBbXTtcclxuXHJcbiAgICAgIGlmIChzaG93V2lzaGxpc3QpIHtcclxuICAgICAgICAgIHRhc2tzLnB1c2goXHJcbiAgICAgICAgICAgICAgZ2V0V2lzaGxpc3RDb3VudChjYXJkSWQpLnRoZW4oY291bnQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0uaXNDb25uZWN0ZWQpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSAoc2hvd093bmVycyAmJiBjb250ZXh0ICE9PSAndXNlckNhcmRzJykgPyAndG9wJyA6ICd0b3AnO1xyXG4gICAgICAgICAgICAgICAgICBhZGRUZXh0TGFiZWwoaXRlbSwgJ3dpc2hsaXN0LXdhcm5pbmcnLCBgJHtjb3VudH1gLCBg0KXQvtGC0Y/RgjogJHtjb3VudH1gLCBwb3NpdGlvbiwgJ3dpc2hsaXN0Jywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgY29sb3I6IGNvdW50ID49IHNldHRpbmdzLndpc2hsaXN0V2FybmluZyA/ICcjRkZBNTAwJyA6ICcjMDBGRjAwJ1xyXG4gICAgICAgICAgICAgICAgICB9LCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiBsb2dFcnJvcihgRXJyb3IgZ2V0dGluZyB3aXNobGlzdCBjb3VudCBmb3IgY2FyZCAke2NhcmRJZH0gaW4gJHtjb250ZXh0fTpgLCBlcnJvcikpXHJcbiAgICAgICAgICApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoc2hvd093bmVycykge1xyXG4gICAgICAgICAgdGFza3MucHVzaChcclxuICAgICAgICAgICAgICBnZXRPd25lcnNDb3VudChjYXJkSWQpLnRoZW4oY291bnQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0uaXNDb25uZWN0ZWQpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSBzaG93V2lzaGxpc3QgPyAnbWlkZGxlJyA6ICd0b3AnO1xyXG4gICAgICAgICAgICAgICAgICBhZGRUZXh0TGFiZWwoaXRlbSwgJ293bmVycy1jb3VudCcsIGAke2NvdW50fWAsIGDQktC70LDQtNC10Y7RgjogJHtjb3VudH1gLCBwb3NpdGlvbiwgJ293bmVycycsIHt9LCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiBsb2dFcnJvcihgRXJyb3IgZ2V0dGluZyBvd25lcnMgY291bnQgZm9yIGNhcmQgJHtjYXJkSWR9IGluICR7Y29udGV4dH06YCwgZXJyb3IpKVxyXG4gICAgICAgICAgKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodGFza3MpO1xyXG4gICAgfSk7IFxyXG5cclxuICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICAgIGlmIChjYXJkSXRlbXMubGVuZ3RoID4gQkFUQ0hfU0laRSAmJiBpICsgQkFUQ0hfU0laRSA8IGNhcmRJdGVtcy5sZW5ndGgpIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgNTApKTtcclxuICAgIH1cclxuICB9IFxyXG59OyIsImV4cG9ydCBjb25zdCBCQVNFX1VSTCA9ICdodHRwczovL21hbmdhYnVmZi5ydSc7XHJcbmV4cG9ydCBjb25zdCBMT0dfUFJFRklYID0gJ1tNYW5nYUJ1ZmZFeHRdJztcclxuZXhwb3J0IGNvbnN0IE1BWF9DT05DVVJSRU5UX1JFUVVFU1RTID0gNTsgXHJcblxyXG5leHBvcnQgY29uc3QgaW5pdGlhbENvbnRleHRTdGF0ZSA9IHtcclxuICB1c2VyQ2FyZHM6IHsgd2lzaGxpc3Q6IGZhbHNlIH0sXHJcbiAgdHJhZGU6IHsgd2lzaGxpc3Q6IHRydWUsIG93bmVyczogdHJ1ZSB9LFxyXG4gIHRyYWRlT2ZmZXI6IHsgd2lzaGxpc3Q6IGZhbHNlLCBvd25lcnM6IGZhbHNlIH0sXHJcbiAgcmVtZWx0OiB7IHdpc2hsaXN0OiBmYWxzZSwgb3duZXJzOiBmYWxzZSB9LFxyXG4gIG1hcmtldDogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICBzcGxpdDogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICBwYWNrOiB7IHdpc2hsaXN0OiB0cnVlLCBvd25lcnM6IGZhbHNlIH0sXHJcbiAgZGVja0NyZWF0ZTogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICBtYXJrZXRDcmVhdGU6IHsgd2lzaGxpc3Q6IGZhbHNlLCBvd25lcnM6IGZhbHNlIH0sXHJcbiAgbWFya2V0UmVxdWVzdENyZWF0ZTogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICBtYXJrZXRSZXF1ZXN0VmlldzogeyB3aXNobGlzdDogdHJ1ZSwgb3duZXJzOiBmYWxzZSB9LCBcclxuICBkZWNrVmlldzogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICBxdWl6UGFnZToge30sXHJcbiAgbWluZVBhZ2U6IHt9XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgY29udGV4dHNTZWxlY3RvcnMgPSB7XHJcbiAgdXNlckNhcmRzOiAnLm1hbmdhLWNhcmRzX19pdGVtW2RhdGEtY2FyZC1pZF0nLFxyXG4gIHRyYWRlOiAnLnRyYWRlX19tYWluLWl0ZW0nLFxyXG4gIHRyYWRlT2ZmZXI6ICcudHJhZGVfX2ludmVudG9yeS1pdGVtJyxcclxuICByZW1lbHQ6ICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgcGFjazogJy5sb290Ym94X19jYXJkW2RhdGEtaWRdJyxcclxuICBtYXJrZXQ6ICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgc3BsaXQ6ICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgZGVja0NyZWF0ZTogJy5jYXJkLWZpbHRlci1saXN0X19jYXJkJyxcclxuICBtYXJrZXRDcmVhdGU6ICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgbWFya2V0UmVxdWVzdENyZWF0ZTogJy5jYXJkLWZpbHRlci1saXN0X19jYXJkW2RhdGEtY2FyZC1pZF0nLFxyXG4gIG1hcmtldFJlcXVlc3RWaWV3OiAnLmNhcmQtcG9vbF9faXRlbVtkYXRhLWlkXScsIFxyXG4gIGRlY2tWaWV3OiAnLmRlY2tfX2l0ZW0nLFxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGdldEN1cnJlbnRDb250ZXh0ID0gKCkgPT4ge1xyXG4gIGNvbnN0IHBhdGggPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWU7XHJcbiAgY29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTsgXHJcblxyXG4gIGNvbnN0IGNvbnRleHRzTWFwID0ge1xyXG4gICAgJy91c2Vycy9cXFxcZCsvY2FyZHMnOiAndXNlckNhcmRzJyxcclxuICAgICcvdHJhZGVzL1xcXFxkKyc6ICd0cmFkZScsXHJcbiAgICAnL3RyYWRlcy9vZmZlcnMvXFxcXGQrJzogJ3RyYWRlT2ZmZXInLFxyXG4gICAgJy9jYXJkcy9wYWNrJzogJ3BhY2snLFxyXG4gICAgJy9jYXJkcy9yZW1lbHQnOiAncmVtZWx0JyxcclxuICAgICcvbWFya2V0L1xcXFxkKyc6ICdtYXJrZXQnLCBcclxuICAgICcvY2FyZHMvc3BsaXQnOiAnc3BsaXQnLFxyXG4gICAgJy9tYXJrZXQvY3JlYXRlJzogJ21hcmtldENyZWF0ZScsXHJcbiAgICAnL2RlY2tzL2NyZWF0ZSc6ICdkZWNrQ3JlYXRlJyxcclxuICAgICcvZGVja3MvXFxcXGQrJzogJ2RlY2tWaWV3JyxcclxuICAgICcvcXVpeic6ICdxdWl6UGFnZScsXHJcbiAgICAnL21pbmUnOiAnbWluZVBhZ2UnLFxyXG4gICAgJy9tYXJrZXQvcmVxdWVzdHMvY3JlYXRlJzogJ21hcmtldFJlcXVlc3RDcmVhdGUnLFxyXG4gICAgJy9tYXJrZXQvcmVxdWVzdHMvXFxcXGQrJzogJ21hcmtldFJlcXVlc3RWaWV3JyBcclxuICB9O1xyXG4gIGZvciAoY29uc3QgW3BhdHRlcm4sIGNvbnRleHRdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRleHRzTWFwKSkge1xyXG4gICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGBeJHtwYXR0ZXJufSRgKTtcclxuICAgIGlmIChjb250ZXh0ID09PSAnbWFya2V0UmVxdWVzdENyZWF0ZScgJiYgcGF0aCA9PT0gJy9tYXJrZXQvcmVxdWVzdHMvY3JlYXRlJykge1xyXG4gICAgICBjb25zb2xlLmxvZyhgJHtMT0dfUFJFRklYfSBEZXRlY3RlZCBjb250ZXh0OiAke2NvbnRleHR9YCk7XHJcbiAgICAgIHJldHVybiBjb250ZXh0O1xyXG4gICAgfSBlbHNlIGlmIChyZWdleC50ZXN0KHBhdGgpKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGAke0xPR19QUkVGSVh9IERldGVjdGVkIGNvbnRleHQ6ICR7Y29udGV4dH1gKTtcclxuICAgICAgcmV0dXJuIGNvbnRleHQ7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGNvbnNvbGUubG9nKGAke0xPR19QUkVGSVh9IE5vIGNvbnRleHQgZGV0ZWN0ZWQgZm9yIHBhdGg6ICR7cGF0aH1gKTtcclxuICByZXR1cm4gbnVsbDtcclxufTsiLCJpbXBvcnQgeyBnZXRTZXR0aW5ncyB9IGZyb20gJy4vc2V0dGluZ3MuanMnO1xyXG5pbXBvcnQgeyBwcm9jZXNzQ2FyZHMgfSBmcm9tICcuL2NhcmRQcm9jZXNzb3IuanMnO1xyXG5pbXBvcnQgeyBnZXRFbGVtZW50cywgd2FpdEZvckVsZW1lbnRzLCBsb2csIGxvZ1dhcm4sIGxvZ0Vycm9yLCBkZWJvdW5jZSwgY2FjaGVkRWxlbWVudHMsIGlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkIH0gZnJvbSAnLi91dGlscy5qcyc7XHJcbmltcG9ydCB7IGNvbnRleHRzU2VsZWN0b3JzLCBCQVNFX1VSTCwgaW5pdGlhbENvbnRleHRTdGF0ZSB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuaW1wb3J0IHsgY29udGV4dFN0YXRlIH0gZnJvbSAnLi9tYWluLmpzJzsgXHJcblxyXG5leHBvcnQgY29uc3QgaW5pdFVzZXJDYXJkcyA9IGFzeW5jICgpID0+IHtcclxuICBjb25zdCBjb250cm9sc0NvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jYXJkLWNvbnRyb2xzLnNjcm9sbC1oaWRkZW4nKTtcclxuICBpZiAoIWNvbnRyb2xzQ29udGFpbmVyKSB7XHJcbiAgICAgIGxvZ1dhcm4oJ2luaXRVc2VyQ2FyZHM6IENvbnRyb2xzIGNvbnRhaW5lciBub3QgZm91bmQuJyk7XHJcbiAgICAgIHJldHVybjtcclxuICB9XHJcbiAgY29udHJvbHNDb250YWluZXIucXVlcnlTZWxlY3RvcignLndpc2hsaXN0LXRvZ2dsZS1idG4nKT8ucmVtb3ZlKCk7XHJcblxyXG4gIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcclxuICBjb25zdCB0b2dnbGVCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICB0b2dnbGVCdG4uY2xhc3NMaXN0LmFkZCgnYnV0dG9uJywgJ3dpc2hsaXN0LXRvZ2dsZS1idG4nKTtcclxuICB0b2dnbGVCdG4uc3R5bGUubWFyZ2luTGVmdCA9ICcxMHB4JztcclxuICBjb250cm9sc0NvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2dnbGVCdG4pO1xyXG5cclxuICBjb25zdCB1cGRhdGVVc2VyQ2FyZEJ1dHRvblN0YXRlID0gKCkgPT4ge1xyXG4gICAgICBnZXRTZXR0aW5ncygpLnRoZW4oY3VycmVudFNldHRpbmdzID0+IHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRDb250ZXh0U3RhdGUgPSBjb250ZXh0U3RhdGVbJ3VzZXJDYXJkcyddIHx8IGluaXRpYWxDb250ZXh0U3RhdGVbJ3VzZXJDYXJkcyddOyBcclxuICAgICAgICAgIGlmIChjdXJyZW50U2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0KSB7XHJcbiAgICAgICAgICAgICAgdG9nZ2xlQnRuLnRleHRDb250ZW50ID0gJ9CW0LXQu9Cw0Y7RidC40LUgKNCy0YHQtdCz0LTQsCknO1xyXG4gICAgICAgICAgICAgIHRvZ2dsZUJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgdG9nZ2xlQnRuLnN0eWxlLm9wYWNpdHkgPSAnMC43JztcclxuICAgICAgICAgICAgICBpZiAoY29udGV4dFN0YXRlLnVzZXJDYXJkcykgY29udGV4dFN0YXRlLnVzZXJDYXJkcy53aXNobGlzdCA9IHRydWU7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGlzQWN0aXZlID0gY3VycmVudENvbnRleHRTdGF0ZS53aXNobGlzdDtcclxuICAgICAgICAgICAgICB0b2dnbGVCdG4udGV4dENvbnRlbnQgPSBpc0FjdGl2ZSA/ICfQodC60YDRi9GC0Ywg0LbQtdC70LDRjtGJ0LjRhScgOiAn0J/QvtC60LDQt9Cw0YLRjCDQttC10LvQsNGO0YnQuNGFJztcclxuICAgICAgICAgICAgICB0b2dnbGVCdG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICB0b2dnbGVCdG4uc3R5bGUub3BhY2l0eSA9ICcxJztcclxuICAgICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgdXBkYXRlVXNlckNhcmRCdXR0b25TdGF0ZSgpO1xyXG5cclxuICB0b2dnbGVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xyXG4gICAgaWYgKGN1cnJlbnRTZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QpIHJldHVybjtcclxuXHJcbiAgICB0b2dnbGVCdG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgdG9nZ2xlQnRuLnRleHRDb250ZW50ID0gJ9CX0LDQs9GA0YPQt9C60LAuLi4nO1xyXG5cclxuICAgIGlmIChjb250ZXh0U3RhdGUudXNlckNhcmRzKSB7XHJcbiAgICAgICAgIGNvbnRleHRTdGF0ZS51c2VyQ2FyZHMud2lzaGxpc3QgPSAhY29udGV4dFN0YXRlLnVzZXJDYXJkcy53aXNobGlzdDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgIGNvbnRleHRTdGF0ZS51c2VyQ2FyZHMgPSB7IC4uLmluaXRpYWxDb250ZXh0U3RhdGUudXNlckNhcmRzLCB3aXNobGlzdDogIWluaXRpYWxDb250ZXh0U3RhdGUudXNlckNhcmRzLndpc2hsaXN0IH07XHJcbiAgICB9XHJcblxyXG4gICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzLnVzZXJDYXJkcyk7IFxyXG4gICAgYXdhaXQgcHJvY2Vzc0NhcmRzKCd1c2VyQ2FyZHMnLCBjdXJyZW50U2V0dGluZ3MpOyBcclxuICAgIHVwZGF0ZVVzZXJDYXJkQnV0dG9uU3RhdGUoKTsgXHJcbiAgICBsb2coYFVzZXJDYXJkczogVG9nZ2xlZCB3aXNobGlzdCB2aXNpYmlsaXR5OiAke2NvbnRleHRTdGF0ZS51c2VyQ2FyZHM/Lndpc2hsaXN0fWApO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBjYXJkSXRlbXMgPSBnZXRFbGVtZW50cyhjb250ZXh0c1NlbGVjdG9ycy51c2VyQ2FyZHMpO1xyXG4gIGNhcmRJdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgaXRlbS5yZW1vdmVFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGhhbmRsZVVzZXJDYXJkQ29udGV4dE1lbnUpOyBcclxuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBoYW5kbGVVc2VyQ2FyZENvbnRleHRNZW51KTtcclxuICB9KTtcclxuXHJcbiAgIGNvbnN0IGluaXRpYWxTaG93V2lzaGxpc3QgPSBzZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgfHwgY29udGV4dFN0YXRlLnVzZXJDYXJkcz8ud2lzaGxpc3Q7XHJcbiAgIGlmIChpbml0aWFsU2hvd1dpc2hsaXN0KSB7XHJcbiAgICAgICBsb2coJ2luaXRVc2VyQ2FyZHM6IEluaXRpYWwgd2lzaGxpc3QgcHJvY2Vzc2luZyBuZWVkZWQuJyk7XHJcbiAgICAgICBjYWNoZWRFbGVtZW50cy5kZWxldGUoY29udGV4dHNTZWxlY3RvcnMudXNlckNhcmRzKTtcclxuICAgICAgIGF3YWl0IHByb2Nlc3NDYXJkcygndXNlckNhcmRzJywgc2V0dGluZ3MpO1xyXG4gICB9XHJcbn07XHJcblxyXG5jb25zdCBoYW5kbGVVc2VyQ2FyZENvbnRleHRNZW51ID0gYXN5bmMgKGUpID0+IHtcclxuICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgY29uc3QgaXRlbSA9IGUuY3VycmVudFRhcmdldDsgXHJcbiAgY29uc3QgbG9ja0J1dHRvbiA9IGl0ZW0ucXVlcnlTZWxlY3RvcignLmxvY2stY2FyZC1idG4nKTtcclxuICBjb25zdCBpbWFnZURpdiA9IGl0ZW0ucXVlcnlTZWxlY3RvcignLm1hbmdhLWNhcmRzX19pbWFnZScpO1xyXG5cclxuICBpZiAoIWxvY2tCdXR0b24pIHtcclxuICAgIGxvZ1dhcm4oJ1VzZXJDYXJkcyBDb250ZXh0TWVudTogTG9jayBidXR0b24gKC5sb2NrLWNhcmQtYnRuKSBub3QgZm91bmQuJyk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIGlmICghaW1hZ2VEaXYpIHtcclxuICAgICAgbG9nV2FybignVXNlckNhcmRzIENvbnRleHRNZW51OiBJbWFnZSBkaXYgKC5tYW5nYS1jYXJkc19faW1hZ2UpIG5vdCBmb3VuZC4nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgY2FyZEluc3RhbmNlSWQgPSBsb2NrQnV0dG9uLmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpO1xyXG4gIGNvbnN0IGJnSW1hZ2VTdHlsZSA9IGltYWdlRGl2LnN0eWxlLmJhY2tncm91bmRJbWFnZTtcclxuICBjb25zdCB1cmxNYXRjaCA9IGJnSW1hZ2VTdHlsZS5tYXRjaCgvdXJsXFwoXCI/KC4rPylcIj9cXCkvKTtcclxuICBjb25zdCBpbWFnZVVybCA9IHVybE1hdGNoID8gdXJsTWF0Y2hbMV0gOiBudWxsO1xyXG5cclxuICBpZiAoIWNhcmRJbnN0YW5jZUlkKSB7XHJcbiAgICBsb2dXYXJuKCdVc2VyQ2FyZHMgQ29udGV4dE1lbnU6IE1pc3NpbmcgZGF0YS1pZCBvbiBsb2NrIGJ1dHRvbi4nKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgIGlmICghaW1hZ2VVcmwpIHtcclxuICAgICBsb2dXYXJuKCdVc2VyQ2FyZHMgQ29udGV4dE1lbnU6IENvdWxkIG5vdCBleHRyYWN0IGltYWdlIFVSTCBmcm9tIHN0eWxlOicsIGJnSW1hZ2VTdHlsZSk7XHJcbiAgICAgcmV0dXJuO1xyXG4gICB9XHJcblxyXG5cclxuICBsb2coYFVzZXJDYXJkcyBDb250ZXh0TWVudTogUmlnaHQtY2xpY2tlZCBjYXJkIGluc3RhbmNlIElEOiAke2NhcmRJbnN0YW5jZUlkfSwgSW1hZ2U6ICR7aW1hZ2VVcmx9YCk7XHJcblxyXG4gIGNvbnN0IGRhdGFUb1NhdmUgPSB7XHJcbiAgICAgIGluc3RhbmNlSWQ6IGNhcmRJbnN0YW5jZUlkLFxyXG4gICAgICBpbWFnZVVybDogaW1hZ2VVcmxcclxuICB9O1xyXG5cclxuICB0cnkge1xyXG4gICAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgc2VsZWN0ZWRNYXJrZXRDYXJkRGF0YTogZGF0YVRvU2F2ZSB9KTtcclxuICAgIGxvZygnVXNlckNhcmRzIENvbnRleHRNZW51OiBTYXZlZCBjYXJkIGRhdGEgdG8gbG9jYWwgc3RvcmFnZTonLCBkYXRhVG9TYXZlKTtcclxuICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gYCR7QkFTRV9VUkx9L21hcmtldC9jcmVhdGVgOyBcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nRXJyb3IoJ1VzZXJDYXJkcyBDb250ZXh0TWVudTogRXJyb3Igc2F2aW5nIGRhdGEgb3IgcmVkaXJlY3Rpbmc6JywgZXJyb3IpO1xyXG4gICAgYWxlcnQoJ9Cd0LUg0YPQtNCw0LvQvtGB0Ywg0YHQvtGF0YDQsNC90LjRgtGMINC00LDQvdC90YvQtSDQutCw0YDRgtGLINC00LvRjyDRgdC+0LfQtNCw0L3QuNGPINC70L7RgtCwLicpO1xyXG4gIH1cclxufTtcclxuXHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlTWFya2V0Q3JlYXRlUGFnZSA9IGFzeW5jICgpID0+IHtcclxuICBsb2coJ01hcmtldENyZWF0ZTogRW50ZXJpbmcgcGFnZScpO1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCB7IHNlbGVjdGVkTWFya2V0Q2FyZERhdGEgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ3NlbGVjdGVkTWFya2V0Q2FyZERhdGEnXSk7XHJcblxyXG4gICAgaWYgKHNlbGVjdGVkTWFya2V0Q2FyZERhdGEgJiYgc2VsZWN0ZWRNYXJrZXRDYXJkRGF0YS5pbnN0YW5jZUlkICYmIHNlbGVjdGVkTWFya2V0Q2FyZERhdGEuaW1hZ2VVcmwpIHtcclxuICAgICAgbG9nKGBNYXJrZXRDcmVhdGU6IEZvdW5kIHNlbGVjdGVkIGNhcmQgZGF0YTpgLCBzZWxlY3RlZE1hcmtldENhcmREYXRhKTtcclxuXHJcbiAgICAgIGNvbnN0IGZpcnN0Q2FyZEl0ZW0gPSBhd2FpdCB3YWl0Rm9yRWxlbWVudHMoY29udGV4dHNTZWxlY3RvcnMubWFya2V0Q3JlYXRlLCA1MDAwLCB0cnVlKTsgXHJcbiAgICAgIGlmICghZmlyc3RDYXJkSXRlbSkge1xyXG4gICAgICAgICAgbG9nV2FybignTWFya2V0Q3JlYXRlOiBObyBjYXJkcyBsb2FkZWQgaW4gdGltZS4nKTtcclxuICAgICAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnJlbW92ZSgnc2VsZWN0ZWRNYXJrZXRDYXJkRGF0YScpOyBcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBsb2coJ01hcmtldENyZWF0ZTogRmlyc3QgY2FyZCBpdGVtIGZvdW5kOicsIGZpcnN0Q2FyZEl0ZW0pO1xyXG5cclxuICAgICAgZmlyc3RDYXJkSXRlbS5jbGljaygpO1xyXG4gICAgICBsb2coJ01hcmtldENyZWF0ZTogQ2xpY2tlZCBvbiB0aGUgZmlyc3QgY2FyZCBpdGVtLicpO1xyXG5cclxuICAgICAgY29uc3QgY2FyZFNob3dDb250YWluZXIgPSBhd2FpdCB3YWl0Rm9yRWxlbWVudHMoJy5jYXJkLXNob3cnLCA1MDAwLCB0cnVlKTtcclxuICAgICAgaWYgKCFjYXJkU2hvd0NvbnRhaW5lcikge1xyXG4gICAgICAgICAgbG9nV2FybignTWFya2V0Q3JlYXRlOiAuY2FyZC1zaG93IGNvbnRhaW5lciBkaWQgbm90IGFwcGVhciBhZnRlciBjbGlja2luZyBmaXJzdCBjYXJkLicpO1xyXG4gICAgICAgICAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwucmVtb3ZlKCdzZWxlY3RlZE1hcmtldENhcmREYXRhJyk7IFxyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGxvZygnTWFya2V0Q3JlYXRlOiAuY2FyZC1zaG93IGNvbnRhaW5lciBhcHBlYXJlZC4nKTtcclxuXHJcbiAgICAgIGNvbnN0IGNhcmRTaG93SGVhZGVyID0gY2FyZFNob3dDb250YWluZXIucXVlcnlTZWxlY3RvcignLmNhcmQtc2hvd19faGVhZGVyJyk7XHJcbiAgICAgIGNvbnN0IGNhcmRTaG93SW1hZ2UgPSBjYXJkU2hvd0NvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcuY2FyZC1zaG93X19pbWFnZScpO1xyXG5cclxuICAgICAgaWYgKGNhcmRTaG93SGVhZGVyKSB7XHJcbiAgICAgICAgICBjYXJkU2hvd0hlYWRlci5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtzZWxlY3RlZE1hcmtldENhcmREYXRhLmltYWdlVXJsfVwiKWA7XHJcbiAgICAgICAgICBsb2coJ01hcmtldENyZWF0ZTogVXBkYXRlZCBjYXJkLXNob3cgaGVhZGVyIGJhY2tncm91bmQgaW1hZ2UuJyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgbG9nV2FybignTWFya2V0Q3JlYXRlOiAuY2FyZC1zaG93X19oZWFkZXIgbm90IGZvdW5kLicpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY2FyZFNob3dJbWFnZSkge1xyXG4gICAgICAgICAgY2FyZFNob3dJbWFnZS5zcmMgPSBzZWxlY3RlZE1hcmtldENhcmREYXRhLmltYWdlVXJsO1xyXG4gICAgICAgICAgbG9nKCdNYXJrZXRDcmVhdGU6IFVwZGF0ZWQgY2FyZC1zaG93IGltYWdlIHNyYy4nKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbG9nV2FybignTWFya2V0Q3JlYXRlOiAuY2FyZC1zaG93X19pbWFnZSBub3QgZm91bmQuJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGhpZGRlbklucHV0TmFtZSA9ICdjYXJkX2lkJzsgXHJcbiAgICAgIGNvbnN0IGhpZGRlbklkSW5wdXQgPSBjYXJkU2hvd0NvbnRhaW5lci5jbG9zZXN0KCdmb3JtJyk/LnF1ZXJ5U2VsZWN0b3IoYGlucHV0W25hbWU9XCIke2hpZGRlbklucHV0TmFtZX1cIl1gKTsgXHJcblxyXG4gICAgICBpZiAoaGlkZGVuSWRJbnB1dCkge1xyXG4gICAgICAgICAgaGlkZGVuSWRJbnB1dC52YWx1ZSA9IHNlbGVjdGVkTWFya2V0Q2FyZERhdGEuaW5zdGFuY2VJZDtcclxuICAgICAgICAgIGxvZyhgTWFya2V0Q3JlYXRlOiBVcGRhdGVkIGhpZGRlbiBpbnB1dCBbbmFtZT1cIiR7aGlkZGVuSW5wdXROYW1lfVwiXSB2YWx1ZSB0bzogJHtzZWxlY3RlZE1hcmtldENhcmREYXRhLmluc3RhbmNlSWR9YCk7XHJcbiAgICAgICAgICBoaWRkZW5JZElucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgICAgICAgICBoaWRkZW5JZElucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbG9nRXJyb3IoYE1hcmtldENyZWF0ZTogSGlkZGVuIGlucHV0IFtuYW1lPVwiJHtoaWRkZW5JbnB1dE5hbWV9XCJdIG5vdCBmb3VuZCEgVGhlIGxvdCBtaWdodCBiZSBjcmVhdGVkIHdpdGggdGhlIHdyb25nIGNhcmQgSUQuYCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnJlbW92ZSgnc2VsZWN0ZWRNYXJrZXRDYXJkRGF0YScpO1xyXG4gICAgICBsb2coJ01hcmtldENyZWF0ZTogUmVtb3ZlZCBjYXJkIGRhdGEgZnJvbSBsb2NhbCBzdG9yYWdlLiBDYXJkIHNlbGVjdGlvbiBmaW5pc2hlZC4nKTtcclxuXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsb2coJ01hcmtldENyZWF0ZTogTm8gc2VsZWN0ZWQgY2FyZCBkYXRhIGZvdW5kIGluIGxvY2FsIHN0b3JhZ2UuJyk7XHJcbiAgICAgIGlmIChzZWxlY3RlZE1hcmtldENhcmREYXRhKSB7XHJcbiAgICAgICAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoJ3NlbGVjdGVkTWFya2V0Q2FyZERhdGEnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBsb2dFcnJvcignTWFya2V0Q3JlYXRlOiBFcnJvciBoYW5kbGluZyBwYWdlIGxvZ2ljOicsIGVycm9yKTtcclxuICAgIHRyeSB7IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnJlbW92ZSgnc2VsZWN0ZWRNYXJrZXRDYXJkRGF0YScpOyB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSBjbGVhbnVwIGVycm9yICovIH1cclxuICB9XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaW5pdFN0YXRzQnV0dG9ucyA9IGFzeW5jIChjb250ZXh0LCB0YXJnZXRTZWxlY3RvciwgYnV0dG9uQ2xhc3MpID0+IHtcclxuICAgIGNvbnN0IHRhcmdldERpdiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0U2VsZWN0b3IpO1xyXG4gICAgaWYgKCF0YXJnZXREaXYpIHtcclxuICAgICAgICBsb2dXYXJuKGBpbml0U3RhdHNCdXR0b25zOiBUYXJnZXQgc2VsZWN0b3IgJyR7dGFyZ2V0U2VsZWN0b3J9JyBub3QgZm91bmQgZm9yIGNvbnRleHQgJyR7Y29udGV4dH0nLmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcclxuICAgIGNvbnN0IGN1cnJlbnRDb250ZXh0U3RhdGUgPSBjb250ZXh0U3RhdGVbY29udGV4dF0gfHwgaW5pdGlhbENvbnRleHRTdGF0ZVtjb250ZXh0XTsgXHJcblxyXG4gICAgY29uc3QgYnV0dG9uc0NvbmZpZyA9IFtcclxuICAgICAgeyBuYW1lOiAnd2lzaGxpc3QnLCB0ZXh0OiAn0JbQtdC70LDRjtGCJywgYWN0aXZlQ2xhc3M6IGAke2J1dHRvbkNsYXNzfS0tYWN0aXZlYCwgZGF0YUF0dHI6IGBkYXRhLSR7Y29udGV4dH0td2lzaGxpc3QtYnRuYCB9LFxyXG4gICAgICB7IG5hbWU6ICdvd25lcnMnLCB0ZXh0OiAn0JLQu9Cw0LTQtdGO0YInLCBhY3RpdmVDbGFzczogYCR7YnV0dG9uQ2xhc3N9LS1hY3RpdmVgLCBkYXRhQXR0cjogYGRhdGEtJHtjb250ZXh0fS1vd25lcnMtYnRuYCB9XHJcbiAgICBdO1xyXG5cclxuICAgIGxldCBuZXh0U2libGluZ0VsZW1lbnQgPSBudWxsO1xyXG4gICAgaWYgKGNvbnRleHQgPT09ICd0cmFkZU9mZmVyJykge1xyXG4gICAgICAgIGNvbnN0IHBvc3NpYmxlQnV0dG9ucyA9IHRhcmdldERpdi5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24sIGEuYnV0dG9uLCAuYnV0dG9uJyk7XHJcbiAgICAgICAgbmV4dFNpYmxpbmdFbGVtZW50ID0gQXJyYXkuZnJvbShwb3NzaWJsZUJ1dHRvbnMpLmZpbmQoZWwgPT4gZWwudGV4dENvbnRlbnQudHJpbSgpLmluY2x1ZGVzKCfQkNC90LjQvNC40YDQvtCy0LDQvdC90YvQtScpKTtcclxuICAgIH1cclxuXHJcbiAgICBidXR0b25zQ29uZmlnLmZvckVhY2goKHsgbmFtZSwgdGV4dCwgYWN0aXZlQ2xhc3MsIGRhdGFBdHRyIH0pID0+IHtcclxuICAgICAgY29uc3QgYWx3YXlzU2hvd1NldHRpbmcgPSBuYW1lID09PSAnd2lzaGxpc3QnID8gc2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IDogc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycztcclxuICAgICAgY29uc3QgZXhpc3RpbmdCdXR0b24gPSB0YXJnZXREaXYucXVlcnlTZWxlY3RvcihgWyR7ZGF0YUF0dHJ9XWApO1xyXG5cclxuICAgICAgbGV0IGJ0biA9IGV4aXN0aW5nQnV0dG9uOyBcclxuXHJcbiAgICAgIGlmICghYnRuKSB7XHJcbiAgICAgICAgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoLi4uYnV0dG9uQ2xhc3Muc3BsaXQoJyAnKS5maWx0ZXIoQm9vbGVhbiksIGAke2NvbnRleHR9LSR7bmFtZX0tYnRuYCk7XHJcbiAgICAgICAgYnRuLnNldEF0dHJpYnV0ZShkYXRhQXR0ciwgJ3RydWUnKTtcclxuICAgICAgICBidG4uc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xyXG4gICAgICAgIGJ0bi5zdHlsZS52ZXJ0aWNhbEFsaWduID0gJ21pZGRsZSc7XHJcbiAgICAgICAgYnRuLnN0eWxlLnRyYW5zaXRpb24gPSAnYmFja2dyb3VuZC1jb2xvciAwLjNzIGVhc2UsIG9wYWNpdHkgMC4zcyBlYXNlJzsgXHJcbiAgICAgICAgYnRuLnN0eWxlLm1hcmdpbkxlZnQgPSAnNXB4JzsgXHJcblxyXG4gICAgICAgIGlmIChuZXh0U2libGluZ0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgIHRhcmdldERpdi5pbnNlcnRCZWZvcmUoYnRuLCBuZXh0U2libGluZ0VsZW1lbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICB0YXJnZXREaXYuYXBwZW5kQ2hpbGQoYnRuKTsgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50U2V0dGluZ3NDbGljayA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50QWx3YXlzU2hvdyA9IG5hbWUgPT09ICd3aXNobGlzdCcgPyBjdXJyZW50U2V0dGluZ3NDbGljay5hbHdheXNTaG93V2lzaGxpc3QgOiBjdXJyZW50U2V0dGluZ3NDbGljay5hbHdheXNTaG93T3duZXJzO1xyXG4gICAgICAgICAgaWYgKGN1cnJlbnRBbHdheXNTaG93KSByZXR1cm47IFxyXG5cclxuICAgICAgICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICAgICAgICBidG4udGV4dENvbnRlbnQgPSAnLi4uJztcclxuXHJcbiAgICAgICAgICBpZiAoY29udGV4dFN0YXRlW2NvbnRleHRdKSB7XHJcbiAgICAgICAgICAgICAgY29udGV4dFN0YXRlW2NvbnRleHRdW25hbWVdID0gIWNvbnRleHRTdGF0ZVtjb250ZXh0XVtuYW1lXTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgY29udGV4dFN0YXRlW2NvbnRleHRdID0geyAuLi5pbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdLCBbbmFtZV06ICFpbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdW25hbWVdIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBjb25zdCBpc0FjdGl2ZSA9IGNvbnRleHRTdGF0ZVtjb250ZXh0XVtuYW1lXTsgXHJcblxyXG4gICAgICAgICAgdXBkYXRlQnV0dG9uQXBwZWFyYW5jZShidG4sIGlzQWN0aXZlLCBuYW1lLCBhY3RpdmVDbGFzcywgdGV4dCwgY3VycmVudEFsd2F5c1Nob3cpOyBcclxuXHJcbiAgICAgICAgICBjYWNoZWRFbGVtZW50cy5kZWxldGUoY29udGV4dHNTZWxlY3RvcnNbY29udGV4dF0pO1xyXG4gICAgICAgICAgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIGN1cnJlbnRTZXR0aW5nc0NsaWNrKVxyXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IGxvZ0Vycm9yKGBFcnJvciBwcm9jZXNzaW5nIGNhcmRzIGFmdGVyICR7bmFtZX0gdG9nZ2xlIGluICR7Y29udGV4dH06YCwgZXJyKSlcclxuICAgICAgICAgICAgLmZpbmFsbHkoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgIHVwZGF0ZUJ1dHRvbkFwcGVhcmFuY2UoYnRuLCBjb250ZXh0U3RhdGVbY29udGV4dF0/LltuYW1lXSwgbmFtZSwgYWN0aXZlQ2xhc3MsIHRleHQsIGN1cnJlbnRBbHdheXNTaG93KTtcclxuICAgICAgICAgICAgICAgICBsb2coYCR7Y29udGV4dH06IFRvZ2dsZWQgJHtuYW1lfSB2aXNpYmlsaXR5OiAke2NvbnRleHRTdGF0ZVtjb250ZXh0XT8uW25hbWVdfWApO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHVwZGF0ZUJ1dHRvbkFwcGVhcmFuY2UoYnRuLCBjdXJyZW50Q29udGV4dFN0YXRlW25hbWVdLCBuYW1lLCBhY3RpdmVDbGFzcywgdGV4dCwgYWx3YXlzU2hvd1NldHRpbmcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2hvdWxkUHJvY2Vzc0luaXRpYWxseSA9IChzZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgfHwgY3VycmVudENvbnRleHRTdGF0ZS53aXNobGlzdCkgfHwgKHNldHRpbmdzLmFsd2F5c1Nob3dPd25lcnMgfHwgY3VycmVudENvbnRleHRTdGF0ZS5vd25lcnMpO1xyXG4gICAgaWYgKHNob3VsZFByb2Nlc3NJbml0aWFsbHkpIHtcclxuICAgICAgbG9nKGBpbml0U3RhdHNCdXR0b25zOiBJbml0aWFsIHByb2Nlc3NpbmcgbmVlZGVkIGZvciAke2NvbnRleHR9LmApO1xyXG4gICAgICBjYWNoZWRFbGVtZW50cy5kZWxldGUoY29udGV4dHNTZWxlY3RvcnNbY29udGV4dF0pOyBcclxuICAgICAgYXdhaXQgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIHNldHRpbmdzKTsgXHJcbiAgICB9XHJcbn07XHJcblxyXG5jb25zdCB1cGRhdGVCdXR0b25BcHBlYXJhbmNlID0gKGJ0biwgaXNBY3RpdmUsIHR5cGUsIGFjdGl2ZUNsYXNzLCBkZWZhdWx0VGV4dCwgYWx3YXlzU2hvdykgPT4ge1xyXG4gICAgaWYgKCFidG4pIHJldHVybjsgXHJcbiAgICBjb25zdCBsYWJlbCA9IHR5cGUgPT09ICd3aXNobGlzdCcgPyAn0JbQtdC70LDRjtGCJyA6ICfQktC70LDQtNC10Y7Rgic7XHJcbiAgICBpZiAoYWx3YXlzU2hvdykge1xyXG4gICAgICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICAgICAgYnRuLnN0eWxlLm9wYWNpdHkgPSAnMC43JztcclxuICAgICAgICBidG4udGV4dENvbnRlbnQgPSBgJHtsYWJlbH0gKNCy0YHQtdCz0LTQsClgO1xyXG4gICAgICAgIGJ0bi5jbGFzc0xpc3QucmVtb3ZlKGFjdGl2ZUNsYXNzKTsgXHJcbiAgICAgICAgYnRuLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcnO1xyXG4gICAgICAgIGJ0bi5zdHlsZS5jb2xvciA9ICcnO1xyXG4gICAgICAgIGJ0bi5zdHlsZS5ib3JkZXJDb2xvciA9ICcnOyBcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICAgICAgYnRuLnN0eWxlLm9wYWNpdHkgPSAnMSc7XHJcbiAgICAgICAgaWYgKGlzQWN0aXZlKSB7XHJcbiAgICAgICAgICAgIGJ0bi5jbGFzc0xpc3QuYWRkKGFjdGl2ZUNsYXNzKTtcclxuICAgICAgICAgICAgYnRuLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjOGU0NGFkJzsgXHJcbiAgICAgICAgICAgIGJ0bi5zdHlsZS5jb2xvciA9ICcjRkZGRkZGJztcclxuICAgICAgICAgICAgYnRuLnN0eWxlLmJvcmRlckNvbG9yID0gJyM4ZTQ0YWQnO1xyXG4gICAgICAgICAgICBidG4udGV4dENvbnRlbnQgPSBg0KHQutGA0YvRgtGMICR7bGFiZWwudG9Mb3dlckNhc2UoKX1gO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJ0bi5jbGFzc0xpc3QucmVtb3ZlKGFjdGl2ZUNsYXNzKTtcclxuICAgICAgICAgICAgYnRuLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcnO1xyXG4gICAgICAgICAgICBidG4uc3R5bGUuY29sb3IgPSAnJztcclxuICAgICAgICAgICAgYnRuLnN0eWxlLmJvcmRlckNvbG9yID0gJyc7XHJcbiAgICAgICAgICAgIGJ0bi50ZXh0Q29udGVudCA9IGDQn9C+0LrQsNC30LDRgtGMICR7bGFiZWwudG9Mb3dlckNhc2UoKX1gO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuXHJcbmV4cG9ydCBjb25zdCBpbml0UGFja1BhZ2UgPSBhc3luYyAoKSA9PiB7XHJcbiAgY29uc3QgcGFja0NvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5sb290Ym94X19pbm5lcicpO1xyXG4gIGlmICghcGFja0NvbnRhaW5lcikge1xyXG4gICAgbG9nV2FybignUGFja1BhZ2U6IFBhY2sgY29udGFpbmVyICgubG9vdGJveF9faW5uZXIpIG5vdCBmb3VuZCcpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgY29uc3QgY29udGV4dCA9ICdwYWNrJztcclxuICBjb25zdCBjdXJyZW50UGFja1N0YXRlID0gY29udGV4dFN0YXRlW2NvbnRleHRdIHx8IGluaXRpYWxDb250ZXh0U3RhdGVbY29udGV4dF07XHJcblxyXG4gIGNvbnN0IHByb2Nlc3NFeGlzdGluZ0NhcmRzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoc2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IHx8IGN1cnJlbnRQYWNrU3RhdGUud2lzaGxpc3QpIHtcclxuICAgICAgICAgIGNvbnN0IGluaXRpYWxDYXJkcyA9IHBhY2tDb250YWluZXIucXVlcnlTZWxlY3RvckFsbChjb250ZXh0c1NlbGVjdG9ycy5wYWNrKTtcclxuICAgICAgICAgIGlmIChpbml0aWFsQ2FyZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgIGNhY2hlZEVsZW1lbnRzLmRlbGV0ZShjb250ZXh0c1NlbGVjdG9ycy5wYWNrKTtcclxuICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoJ3BhY2snLCBzZXR0aW5ncyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgY29uc3QgZXhpc3RpbmdMYWJlbHMgPSBwYWNrQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy53aXNobGlzdC13YXJuaW5nLCAub3duZXJzLWNvdW50Jyk7XHJcbiAgICAgICAgICAgZXhpc3RpbmdMYWJlbHMuZm9yRWFjaChsYWJlbCA9PiBsYWJlbC5yZW1vdmUoKSk7XHJcbiAgICAgIH1cclxuICB9O1xyXG5cclxuICBhd2FpdCBwcm9jZXNzRXhpc3RpbmdDYXJkcygpO1xyXG5cclxuICBjb25zdCBvYnNlcnZlckNhbGxiYWNrID0gZGVib3VuY2UoYXN5bmMgKG11dGF0aW9ucykgPT4ge1xyXG4gICAgICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHtcclxuICAgICAgICAgIGxvZ1dhcm4oJ1BhY2tQYWdlOiBPYnNlcnZlciBjYWxsYmFjayBza2lwcGVkLCBleHRlbnNpb24gY29udGV4dCBsb3N0LicpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGxldCBjYXJkc0NoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCBtdXRhdGlvbiBvZiBtdXRhdGlvbnMpIHtcclxuICAgICAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hpbGRMaXN0Jykge1xyXG4gICAgICAgICAgICAgIGlmIChBcnJheS5mcm9tKG11dGF0aW9uLmFkZGVkTm9kZXMpLnNvbWUobm9kZSA9PiBub2RlLm5vZGVUeXBlID09PSAxICYmIG5vZGUubWF0Y2hlcz8uKGNvbnRleHRzU2VsZWN0b3JzLnBhY2spKSB8fFxyXG4gICAgICAgICAgICAgICAgICBBcnJheS5mcm9tKG11dGF0aW9uLnJlbW92ZWROb2Rlcykuc29tZShub2RlID0+IG5vZGUubm9kZVR5cGUgPT09IDEgJiYgbm9kZS5tYXRjaGVzPy4oY29udGV4dHNTZWxlY3RvcnMucGFjaykpKSB7XHJcbiAgICAgICAgICAgICAgICAgIGNhcmRzQ2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBpZiAoQXJyYXkuZnJvbShtdXRhdGlvbi5hZGRlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5ub2RlVHlwZSA9PT0gMSAmJiBub2RlLnF1ZXJ5U2VsZWN0b3I/Lihjb250ZXh0c1NlbGVjdG9ycy5wYWNrKSkgfHxcclxuICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShtdXRhdGlvbi5yZW1vdmVkTm9kZXMpLnNvbWUobm9kZSA9PiBub2RlLm5vZGVUeXBlID09PSAxICYmIG5vZGUucXVlcnlTZWxlY3Rvcj8uKGNvbnRleHRzU2VsZWN0b3JzLnBhY2spKSkge1xyXG4gICAgICAgICAgICAgICAgICAgY2FyZHNDaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICB9IGVsc2UgaWYgKG11dGF0aW9uLnR5cGUgPT09ICdhdHRyaWJ1dGVzJyAmJiAobXV0YXRpb24uYXR0cmlidXRlTmFtZSA9PT0gJ2RhdGEtaWQnIHx8IG11dGF0aW9uLmF0dHJpYnV0ZU5hbWUgPT09ICdjbGFzcycpICYmIG11dGF0aW9uLnRhcmdldC5tYXRjaGVzPy4oY29udGV4dHNTZWxlY3RvcnMucGFjaykpIHtcclxuICAgICAgICAgICAgICBjYXJkc0NoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY2FyZHNDaGFuZ2VkKSB7XHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpOyBcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRQYWNrU3RhdGVVcGRhdGVkID0gY29udGV4dFN0YXRlW2NvbnRleHRdIHx8IGluaXRpYWxDb250ZXh0U3RhdGVbY29udGV4dF07IFxyXG4gICAgICAgICAgY29uc3Qgc2hvdWxkU2hvd0xhYmVscyA9IGN1cnJlbnRTZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgfHwgY3VycmVudFBhY2tTdGF0ZVVwZGF0ZWQud2lzaGxpc3Q7XHJcblxyXG4gICAgICAgICAgaWYgKHNob3VsZFNob3dMYWJlbHMpIHtcclxuICAgICAgICAgICAgICBjYWNoZWRFbGVtZW50cy5kZWxldGUoY29udGV4dHNTZWxlY3RvcnMucGFjayk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIGN1cnJlbnRTZXR0aW5ncyk7IFxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBjb25zdCBjYXJkSXRlbXMgPSBnZXRFbGVtZW50cyhjb250ZXh0c1NlbGVjdG9ycy5wYWNrKTtcclxuICAgICAgICAgICAgICBjYXJkSXRlbXMuZm9yRWFjaChpdGVtID0+IHtcclxuICAgICAgICAgICAgICAgICAgaXRlbS5xdWVyeVNlbGVjdG9yKCcud2lzaGxpc3Qtd2FybmluZycpPy5yZW1vdmUoKTtcclxuICAgICAgICAgICAgICAgICAgaXRlbS5xdWVyeVNlbGVjdG9yKCcub3duZXJzLWNvdW50Jyk/LnJlbW92ZSgpOyBcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgfVxyXG4gIH0sIDMwMCk7IFxyXG5cclxuICBpZiAoIXBhY2tDb250YWluZXIuX2V4dGVuc2lvbk9ic2VydmVyKSB7XHJcbiAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIob2JzZXJ2ZXJDYWxsYmFjayk7XHJcbiAgICAgIG9ic2VydmVyLm9ic2VydmUocGFja0NvbnRhaW5lciwge1xyXG4gICAgICAgICAgY2hpbGRMaXN0OiB0cnVlLCBcclxuICAgICAgICAgIHN1YnRyZWU6IHRydWUsICAgXHJcbiAgICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLCBcclxuICAgICAgICAgIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLWlkJywgJ2NsYXNzJ10gXHJcbiAgICAgIH0pO1xyXG4gICAgICBwYWNrQ29udGFpbmVyLl9leHRlbnNpb25PYnNlcnZlciA9IG9ic2VydmVyOyBcclxuICAgICAgbG9nKCdQYWNrUGFnZTogU2V0dXAgb2JzZXJ2ZXIgZm9yIHBhY2sgY29udGFpbmVyJyk7XHJcbiAgfSBlbHNlIHtcclxuICAgICAgIGxvZ1dhcm4oJ1BhY2tQYWdlOiBPYnNlcnZlciBhbHJlYWR5IGV4aXN0cyBmb3IgcGFjayBjb250YWluZXIuJyk7XHJcbiAgfVxyXG59OyIsImltcG9ydCB7IGxvZywgbG9nV2FybiwgbG9nRXJyb3IgfSBmcm9tICcuL3V0aWxzLmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBhZGRUZXh0TGFiZWwgPSAoY29udGFpbmVyLCBjbGFzc05hbWUsIHRleHQsIHRpdGxlLCBwb3NpdGlvbiwgdHlwZSwgb3B0aW9ucyA9IHt9LCBjb250ZXh0KSA9PiB7XHJcbiAgaWYgKCFjb250YWluZXIgfHwgIShjb250YWluZXIgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGV4aXN0aW5nTGFiZWwgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcihgLiR7Y2xhc3NOYW1lfWApO1xyXG4gICAgaWYgKGV4aXN0aW5nTGFiZWwpIGV4aXN0aW5nTGFiZWwucmVtb3ZlKCk7XHJcblxyXG4gICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBkaXYuY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xyXG4gICAgZGl2LnRpdGxlID0gdGl0bGU7XHJcblxyXG4gICAgY29uc3Qgc3ZnSWNvbkNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIHN2Z0ljb25Db250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtZmxleCc7XHJcbiAgICBzdmdJY29uQ29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSAnY2VudGVyJztcclxuXHJcbiAgICBsZXQgc3ZnU3RyaW5nID0gJyc7XHJcbiAgICBpZiAodHlwZSA9PT0gJ3dpc2hsaXN0Jykge1xyXG4gICAgICBzdmdTdHJpbmcgPSBgXHJcbiAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiMTJcIiBoZWlnaHQ9XCIxMlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBtaWRkbGU7XCI+XHJcbiAgICAgICAgICA8cGF0aCBkPVwiTTEyIDIxLjM1bC0xLjQ1LTEuMzJDNS40IDE1LjM2IDIgMTIuMjggMiA4LjUgMiA1LjQyIDQuNDIgMyA3LjUgM2MxLjc0IDAgMy40MS44MSA0LjUgMi4wOUMxMy4wOSAzLjgxIDE0Ljc2IDMgMTYuNSAzIDE5LjU4IDMgMjIgNS40MiAyMiA4LjVjMCAzLjc4LTMuNCA2Ljg2LTguNTUgMTEuNTRMMTIgMjEuMzV6XCIvPlxyXG4gICAgICAgIDwvc3ZnPmA7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdvd25lcnMnKSB7XHJcbiAgICAgIHN2Z1N0cmluZyA9IGBcclxuICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9XCIxMlwiIGhlaWdodD1cIjEyXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHN0eWxlPVwidmVydGljYWwtYWxpZ246IG1pZGRsZTtcIj5cclxuICAgICAgICAgIDxwYXRoIGQ9XCJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNCAxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6XCIvPlxyXG4gICAgICAgIDwvc3ZnPmA7XHJcbiAgICB9XHJcbiAgICBzdmdJY29uQ29udGFpbmVyLmlubmVySFRNTCA9IHN2Z1N0cmluZztcclxuXHJcbiAgICBjb25zdCB0ZXh0U3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIHRleHRTcGFuLnRleHRDb250ZW50ID0gdGV4dDtcclxuICAgIHRleHRTcGFuLnN0eWxlLmxpbmVIZWlnaHQgPSAnMSc7XHJcblxyXG4gICAgZGl2LmFwcGVuZENoaWxkKHN2Z0ljb25Db250YWluZXIpO1xyXG4gICAgZGl2LmFwcGVuZENoaWxkKHRleHRTcGFuKTtcclxuXHJcbiAgICBjb25zdCBpc1VzZXJDYXJkcyA9IGNvbnRleHQgPT09ICd1c2VyQ2FyZHMnO1xyXG4gICAgY29uc3QgaXNEZWNrVmlldyA9IGNvbnRleHQgPT09ICdkZWNrVmlldyc7XHJcbiAgICBjb25zdCBwb3NpdGlvblN0eWxlID0gaXNVc2VyQ2FyZHMgPyAnbGVmdDogNXB4OycgOiAncmlnaHQ6IDVweDsnO1xyXG4gICAgY29uc3QgdG9wUG9zaXRpb24gPSAocG9zaXRpb24gPT09ICd0b3AnKSA/ICc1cHgnIDogJzI1cHgnO1xyXG4gICAgY29uc3QgZGVja1ZpZXdTdHlsZXMgPSBpc0RlY2tWaWV3ID8gYFxyXG4gICAgICB6LWluZGV4OiAxMDAwO1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIHBhZGRpbmc6IDNweCA2cHg7XHJcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMCwgMCwgMCwgMC44KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgJHtvcHRpb25zLmNvbG9yIHx8ICcjRkZGRkZGJ307XHJcbiAgICBgIDogJyc7XHJcblxyXG4gICAgZGl2LnN0eWxlLmNzc1RleHQgPSBgXHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiAke3RvcFBvc2l0aW9ufTtcclxuICAgICAgJHtwb3NpdGlvblN0eWxlfVxyXG4gICAgICBjb2xvcjogJHtvcHRpb25zLmNvbG9yIHx8ICcjRkZGRkZGJ307XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgYmFja2dyb3VuZC1jb2xvcjogcmdiYSgwLCAwLCAwLCAwLjcpO1xyXG4gICAgICBwYWRkaW5nOiAycHggNXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAzcHg7XHJcbiAgICAgIHotaW5kZXg6IDEwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgJHtkZWNrVmlld1N0eWxlc31cclxuICAgIGA7XHJcblxyXG4gICAgaWYgKGlzRGVja1ZpZXcpIHtcclxuICAgICAgICAgY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgIGlmIChnZXRDb21wdXRlZFN0eWxlKGNvbnRhaW5lcikucG9zaXRpb24gPT09ICdzdGF0aWMnKSB7XHJcbiAgICAgICAgICAgICBjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xyXG4gICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGRpdik7XHJcblxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGxvZ0Vycm9yKGBFcnJvciBhZGRpbmcgbGFiZWwgXCIke2NsYXNzTmFtZX1cIiBpbiBjb250ZXh0IFwiJHtjb250ZXh0fVwiOmAsIGVycm9yLCBjb250YWluZXIpO1xyXG4gIH1cclxufTtcclxuXHJcblxyXG5leHBvcnQgY29uc3QgYWRkRXh0ZW5zaW9uU2V0dGluZ3NCdXR0b24gPSAoKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IG1lbnUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZHJvcGRvd25fX2NvbnRlbnQgLm1lbnUtLXByb2ZpbGUnKTtcclxuICAgIGlmICghbWVudSB8fCBtZW51LnF1ZXJ5U2VsZWN0b3IoJy5tZW51X19pdGVtLS1leHRlbnNpb24tc2V0dGluZ3MnKSkgcmV0dXJuO1xyXG4gICAgY29uc3Qgc2V0dGluZ3NCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICBzZXR0aW5nc0J1dHRvbi5jbGFzc0xpc3QuYWRkKCdtZW51X19pdGVtJywgJ21lbnVfX2l0ZW0tLWV4dGVuc2lvbi1zZXR0aW5ncycpO1xyXG4gICAgc2V0dGluZ3NCdXR0b24udGFyZ2V0ID0gJ19ibGFuayc7XHJcbiAgICBzZXR0aW5nc0J1dHRvbi5ocmVmID0gY2hyb21lLnJ1bnRpbWUuZ2V0VVJMKCdpbnRlcmZhY2UuaHRtbCcpO1xyXG4gICAgc2V0dGluZ3NCdXR0b24uaW5uZXJIVE1MID0gYFxyXG4gICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE2XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHN0eWxlPVwidmVydGljYWwtYWxpZ246IG1pZGRsZTsgbWFyZ2luLXJpZ2h0OiA4cHg7XCI+XHJcbiAgICAgICAgPHBhdGggZD1cIk0xOS40MyAxMi45OGMuMDQtLjMyLjA3LS42NC4wNy0uOThzLS4wMy0uNjYtLjA3LS45OGwyLjExLTEuNjVjLjE5LS4xNS4yNC0uNDIuMTItLjY0bC0yLTMuNDZjLS4xMi0uMjItLjM5LS4zLS42MS0uMjJsLTIuNDkgMWMtLjUyLS40LTEuMDgtLjczLTEuNjktLjk4bC0uMzgtMi42NUMxNC40NiAyLjE4IDE0LjI1IDIgMTQgMmgtNGMtLjI1IDAtLjQ2LjE4LS40OS40MmwtLjM4IDIuNjVjLS42MS4yNS0xLjE3LjU5LTEuNjkuOThsLTIuNDktMWMtLjIzLS4wOC0uNDkgMC0uNjEuMjJsLTIgMy40NmMtLjEzLjIyLS4wNy40OS4xMi42NGwyLjExIDEuNjVjLS4wNC4zMi0uMDcuNjUtLjA3Ljk4cy4wMy42Ni4wNy45OGwtMi4xMSAxLjY1Yy0uMTkuMTUtLjI0LjQyLS4xMi42NGwyIDMuNDZjLjEyLjIyLjM5LjMuNjEuMjJsMi40OS0xYy41Mi40IDEuMDguNzMgMS42OS45OGwuMzggMi42NWMuMDMuMjQuMjQuNDIuNDkuNDJoNGMuMjUgMCAuNDYtLjE4LjQ5LS40MmwuMzgtMi42NWMuNjEtLjI1IDEuMTctLjU5IDEuNjktLjk4bDIuNDkgMWMuMjMuMDguNDkgMCAuNjEtLjIybDItMy40NmMuMTItLjIyLjA3LS40OS0uMTItLjY0bC0yLjExLTEuNjV6TTEyIDE1LjVjLTEuOTMgMC0zLjUtMS41Ny0zLjUtMy41czEuNTctMy41IDMuNS0zLjUgMy41IDEuNTcgMy41IDMuNS0xLjU3IDMuNS0zLjUgMy41elwiLz5cclxuICAgICAgPC9zdmc+XHJcbiAgICAgINCd0LDRgdGC0YDQvtC50LrQuCDRgNCw0YHRiNC40YDQtdC90LjRj2A7XHJcbiAgICBtZW51LmFwcGVuZENoaWxkKHNldHRpbmdzQnV0dG9uKTtcclxuICAgIGxvZygnQWRkZWQgZXh0ZW5zaW9uIHNldHRpbmdzIGJ1dHRvbicpO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBhZGRpbmcgc2V0dGluZ3MgYnV0dG9uOicsIGVycm9yKTtcclxuICB9XHJcbn07IiwiaW1wb3J0IHsgTE9HX1BSRUZJWCwgaW5pdGlhbENvbnRleHRTdGF0ZSwgY29udGV4dHNTZWxlY3RvcnMsIGdldEN1cnJlbnRDb250ZXh0IH0gZnJvbSAnLi9jb25maWcuanMnO1xyXG5pbXBvcnQgeyBpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCwgbG9nLCBsb2dXYXJuLCBsb2dFcnJvciwgY2FjaGVkRWxlbWVudHMsIGRlYm91bmNlLCB3YWl0Rm9yRWxlbWVudHMgfSBmcm9tICcuL3V0aWxzLmpzJztcclxuaW1wb3J0IHsgc2V0Q3NyZlRva2VuLCBjc3JmVG9rZW4sIHBlbmRpbmdSZXF1ZXN0cyB9IGZyb20gJy4vYXBpLmpzJztcclxuaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tICcuL3NldHRpbmdzLmpzJztcclxuaW1wb3J0IHsgYWRkRXh0ZW5zaW9uU2V0dGluZ3NCdXR0b24gfSBmcm9tICcuL2RvbVV0aWxzLmpzJztcclxuaW1wb3J0IHsgcHJvY2Vzc0NhcmRzIH0gZnJvbSAnLi9jYXJkUHJvY2Vzc29yLmpzJztcclxuaW1wb3J0IHsgaW5pdFVzZXJDYXJkcywgaGFuZGxlTWFya2V0Q3JlYXRlUGFnZSwgaW5pdFN0YXRzQnV0dG9ucywgaW5pdFBhY2tQYWdlIH0gZnJvbSAnLi9jb250ZXh0SGFuZGxlcnMuanMnO1xyXG5pbXBvcnQgeyBzZXR1cE9ic2VydmVyIH0gZnJvbSAnLi9vYnNlcnZlci5qcyc7XHJcbmltcG9ydCB7IHN0YXJ0UXVpeiB9IGZyb20gJy4vcXVpekhhbmRsZXIuanMnO1xyXG5pbXBvcnQgeyBzdGFydE1pbmluZ1Byb2Nlc3MgfSBmcm9tICcuL21pbmVIYW5kbGVyLmpzJztcclxuXHJcbmV4cG9ydCBsZXQgY29udGV4dFN0YXRlID0ge307XHJcbmxldCBjdXJyZW50T2JzZXJ2ZXIgPSBudWxsO1xyXG5cclxuY29uc3QgY2xlYW51cEV4dGVuc2lvbkZlYXR1cmVzID0gKCkgPT4ge1xyXG4gICAgbG9nKCdDbGVhbmluZyB1cCBleHRlbnNpb24gZmVhdHVyZXMuLi4nKTtcclxuXHJcbiAgICBpZiAoY3VycmVudE9ic2VydmVyKSB7XHJcbiAgICAgICAgY3VycmVudE9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICBjdXJyZW50T2JzZXJ2ZXIgPSBudWxsO1xyXG4gICAgICAgIGxvZygnT2JzZXJ2ZXIgZGlzY29ubmVjdGVkLicpO1xyXG4gICAgfVxyXG5cclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhdXRvLXF1aXotc3RhcnQtYnRuJyk/LnJlbW92ZSgpO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2F1dG8tbWluZS1jb3VudGVyJyk/LnJlbW92ZSgpO1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLndpc2hsaXN0LXRvZ2dsZS1idG4nKT8ucmVtb3ZlKCk7XHJcbiAgICBjb25zdCBzdGF0QnV0dG9uU2VsZWN0b3JzID0gW1xyXG4gICAgICAgICcudHJhZGVPZmZlci13aXNobGlzdC1idG4nLCAnLnRyYWRlT2ZmZXItb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5yZW1lbHQtd2lzaGxpc3QtYnRuJywgJy5yZW1lbHQtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5tYXJrZXQtd2lzaGxpc3QtYnRuJywgJy5tYXJrZXQtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5zcGxpdC13aXNobGlzdC1idG4nLCAnLnNwbGl0LW93bmVycy1idG4nLFxyXG4gICAgICAgICcuZGVja0NyZWF0ZS13aXNobGlzdC1idG4nLCAnLmRlY2tDcmVhdGUtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5tYXJrZXRDcmVhdGUtd2lzaGxpc3QtYnRuJywgJy5tYXJrZXRDcmVhdGUtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5tYXJrZXRSZXF1ZXN0Q3JlYXRlLXdpc2hsaXN0LWJ0bicsICcubWFya2V0UmVxdWVzdENyZWF0ZS1vd25lcnMtYnRuJyxcclxuICAgIF07XHJcbiAgICBzdGF0QnV0dG9uU2VsZWN0b3JzLmZvckVhY2goc2VsZWN0b3IgPT4ge1xyXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpLmZvckVhY2goYnRuID0+IGJ0bi5yZW1vdmUoKSk7XHJcbiAgICB9KTtcclxuICAgIGxvZygnUmVtb3ZlZCBkeW5hbWljIGJ1dHRvbnMuJyk7XHJcblxyXG4gICAgY29uc3Qgb2xkTGFiZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLndpc2hsaXN0LXdhcm5pbmcsIC5vd25lcnMtY291bnQnKTtcclxuICAgIG9sZExhYmVscy5mb3JFYWNoKGxhYmVsID0+IGxhYmVsLnJlbW92ZSgpKTtcclxuICAgIGxvZyhgUmVtb3ZlZCAke29sZExhYmVscy5sZW5ndGh9IGxhYmVscy5gKTtcclxuXHJcbiAgICBjYWNoZWRFbGVtZW50cy5jbGVhcigpO1xyXG4gICAgbG9nKCdDbGVhcmVkIGNhY2hlZCBlbGVtZW50cy4nKTtcclxuXHJcbn07XHJcblxyXG5jb25zdCBpbml0aWFsaXplT2JzZXJ2ZXIgPSAoY29udGV4dCkgPT4ge1xyXG4gICAgIGlmIChjb250ZXh0ICE9PSAncGFjaycgJiYgY29udGV4dCAhPT0gJ21hcmtldFJlcXVlc3RWaWV3JyAmJiBjb250ZXh0ICE9PSAncXVpelBhZ2UnICYmIGNvbnRleHQgIT09ICdtaW5lUGFnZScpIHtcclxuICAgICAgICAgc2V0dXBPYnNlcnZlcihjb250ZXh0LCBvYnMgPT4geyBjdXJyZW50T2JzZXJ2ZXIgPSBvYnM7IH0pO1xyXG4gICAgIH1cclxufVxyXG5cclxuY29uc3QgYWRkUXVpekJ1dHRvbiA9IGFzeW5jICgpID0+IHtcclxuICAgIGxvZygnQXR0ZW1wdGluZyB0byBhZGQgUXVpeiBidXR0b24uLi4nKTtcclxuICAgIGNvbnN0IGJ1dHRvbkNvbnRhaW5lclNlbGVjdG9yID0gJy5xdWl6X19oZWFkZXInO1xyXG4gICAgY29uc3QgY29udGFpbmVyID0gYXdhaXQgd2FpdEZvckVsZW1lbnRzKGJ1dHRvbkNvbnRhaW5lclNlbGVjdG9yLCA1MDAwLCB0cnVlKTtcclxuXHJcbiAgICBpZiAoY29udGFpbmVyKSB7XHJcbiAgICAgICAgaWYgKCFjb250YWluZXIucXVlcnlTZWxlY3RvcignI2F1dG8tcXVpei1zdGFydC1idG4nKSkge1xyXG4gICAgICAgICAgICBsb2coJ1F1aXogaGVhZGVyIGNvbnRhaW5lciBmb3VuZCwgYWRkaW5nIGJ1dHRvbi4nKTtcclxuICAgICAgICAgICAgY29uc3QgcXVpekJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgICAgICAgICBxdWl6QnV0dG9uLmlkID0gJ2F1dG8tcXVpei1zdGFydC1idG4nO1xyXG4gICAgICAgICAgICBxdWl6QnV0dG9uLnRleHRDb250ZW50ID0gJ+KaoSDQkNCy0YLQvi3QmtCy0LjQtyc7XHJcbiAgICAgICAgICAgIHF1aXpCdXR0b24udGl0bGUgPSAn0JfQsNC/0YPRgdGC0LjRgtGMINCw0LLRgtC+0LzQsNGC0LjRh9C10YHQutC+0LUg0L/RgNC+0YXQvtC20LTQtdC90LjQtSDQutCy0LjQt9CwJztcclxuICAgICAgICAgICAgcXVpekJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdidXR0b24nKTtcclxuICAgICAgICAgICAgcXVpekJ1dHRvbi5zdHlsZS5tYXJnaW5MZWZ0ID0gJzE1cHgnO1xyXG4gICAgICAgICAgICBxdWl6QnV0dG9uLnN0eWxlLnZlcnRpY2FsQWxpZ24gPSAnbWlkZGxlJztcclxuXHJcbiAgICAgICAgICAgIHF1aXpCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHsgYWxlcnQoJ9Ca0L7QvdGC0LXQutGB0YIg0YDQsNGB0YjQuNGA0LXQvdC40Y8g0L3QtdC00LXQudGB0YLQstC40YLQtdC70LXQvS4nKTsgcmV0dXJuOyB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIWNzcmZUb2tlbikgeyBhbGVydCgnQ1NSRiDRgtC+0LrQtdC9INC90LUg0L3QsNC50LTQtdC9LicpOyBsb2dFcnJvcignUXVpeiBzdGFydCBibG9ja2VkOiBDU1JGIHRva2VuIGlzIG51bGwgb3IgZW1wdHkuJyk7IHJldHVybjsgfVxyXG5cclxuICAgICAgICAgICAgICAgIHF1aXpCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgcXVpekJ1dHRvbi50ZXh0Q29udGVudCA9ICfij7Mg0JrQstC40Lcg0LfQsNC/0YPRidC10L0uLi4nO1xyXG4gICAgICAgICAgICAgICAgbG9nKCfQl9Cw0L/Rg9GB0LrQsNC10Lwgc3RhcnRRdWl6Li4uJyk7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHN0YXJ0UXVpeigpO1xyXG4gICAgICAgICAgICAgICAgICAgIHF1aXpCdXR0b24udGV4dENvbnRlbnQgPSAn4pyU77iPINCa0LLQuNC3INC30LDQstC10YDRiNC10L0nO1xyXG4gICAgICAgICAgICAgICAgICAgIGxvZygnc3RhcnRRdWl6INC30LDQstC10YDRiNC40Lsg0YDQsNCx0L7RgtGDLicpO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcign0J7RiNC40LHQutCwINCy0L4g0LLRgNC10LzRjyDQstGL0L/QvtC70L3QtdC90LjRjyBzdGFydFF1aXo6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgIHF1aXpCdXR0b24udGV4dENvbnRlbnQgPSAn4p2MINCe0YjQuNCx0LrQsCDQutCy0LjQt9CwJztcclxuICAgICAgICAgICAgICAgICAgICBhbGVydChg0J/RgNC+0LjQt9C+0YjQu9CwINC+0YjQuNCx0LrQsCDQstC+INCy0YDQtdC80Y8g0LrQstC40LfQsDogJHtlcnJvci5tZXNzYWdlIHx8ICfQodC8LiDQutC+0L3RgdC+0LvRjC4nfWApO1xyXG4gICAgICAgICAgICAgICAgfSBmaW5hbGx5IHtcclxuXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29udGFpbmVyLnByZXBlbmQocXVpekJ1dHRvbik7XHJcbiAgICAgICAgICAgIGxvZygn0JDQstGC0L4t0JrQstC40LcgYnV0dG9uIGFkZGVkLicpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxvZygn0JDQstGC0L4t0JrQstC40LcgYnV0dG9uIGFscmVhZHkgZXhpc3RzLicpO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgIGxvZ1dhcm4oYFF1aXogaGVhZGVyIGNvbnRhaW5lciAoJyR7YnV0dG9uQ29udGFpbmVyU2VsZWN0b3J9Jykgbm90IGZvdW5kIGFmdGVyIHdhaXRpbmcuYCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5jb25zdCBpbml0TWluZVBhZ2UgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBtaW5lQnV0dG9uU2VsZWN0b3IgPSAnLm1haW4tbWluZV9fZ2FtZS10YXAnO1xyXG4gICAgY29uc3QgbWluZUJ1dHRvbiA9IGF3YWl0IHdhaXRGb3JFbGVtZW50cyhtaW5lQnV0dG9uU2VsZWN0b3IsIDUwMDAsIHRydWUpO1xyXG4gICAgY29uc3QgY291bnRlcklkID0gJ2F1dG8tbWluZS1jb3VudGVyJztcclxuXHJcbiAgICBpZiAoIW1pbmVCdXR0b24pIHtcclxuICAgICAgICBsb2dXYXJuKGBNaW5lIGJ1dHRvbiAoJyR7bWluZUJ1dHRvblNlbGVjdG9yfScpIG5vdCBmb3VuZCBhZnRlciB3YWl0aW5nLmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY291bnRlcklkKSkge1xyXG4gICAgICAgIGxvZ1dhcm4oYE1pbmUgY291bnRlciAoJyMke2NvdW50ZXJJZH0nKSBhbHJlYWR5IGV4aXN0cy5gKTtcclxuICAgICAgICByZXR1cm47IFxyXG4gICAgfVxyXG5cclxuICAgIGxvZygnSW5pdGlhbGl6aW5nIG1pbmUgcGFnZSAoQnVyc3QgTW9kZSkuLi4nKTtcclxuXHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgICBjb25zdCBoaXRzQ291bnQgPSBzZXR0aW5ncy5taW5lSGl0Q291bnQ7XHJcblxyXG4gICAgY29uc3QgY291bnRlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGNvdW50ZXJFbGVtZW50LmlkID0gY291bnRlcklkO1xyXG4gICAgY291bnRlckVsZW1lbnQudGV4dENvbnRlbnQgPSBg0KPQtNCw0YAgeCR7aGl0c0NvdW50fWA7XHJcbiAgICBjb3VudGVyRWxlbWVudC5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcclxuICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLm1hcmdpblRvcCA9ICcxMHB4JztcclxuICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzE0cHgnO1xyXG4gICAgY291bnRlckVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdib2xkJztcclxuICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLmNvbG9yID0gJyNGRkYnO1xyXG4gICAgY291bnRlckVsZW1lbnQuc3R5bGUudGV4dFNoYWRvdyA9ICcxcHggMXB4IDJweCBibGFjayc7XHJcbiAgICBjb3VudGVyRWxlbWVudC5zdHlsZS5taW5IZWlnaHQgPSAnMS4yZW0nOyBcclxuXHJcbiAgICBtaW5lQnV0dG9uLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGNvdW50ZXJFbGVtZW50LCBtaW5lQnV0dG9uLm5leHRTaWJsaW5nKTtcclxuICAgIGxvZygnTWluZSBjb3VudGVyIGVsZW1lbnQgYWRkZWQuJyk7XHJcblxyXG4gICAgbGV0IGlzTWluaW5nID0gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgdXBkYXRlQnV0dG9uU3RhdGUgPSAoZGlzYWJsZWQpID0+IHtcclxuICAgICAgICBtaW5lQnV0dG9uLmRpc2FibGVkID0gZGlzYWJsZWQ7XHJcbiAgICAgICAgbWluZUJ1dHRvbi5zdHlsZS5vcGFjaXR5ID0gZGlzYWJsZWQgPyAnMC42JyA6ICcxJztcclxuICAgICAgICBtaW5lQnV0dG9uLnN0eWxlLmN1cnNvciA9IGRpc2FibGVkID8gJ3dhaXQnIDogJ3BvaW50ZXInO1xyXG4gICAgICAgIGlzTWluaW5nID0gZGlzYWJsZWQ7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUNvdW50ZXIgPSAoY3VycmVudCwgbWF4LCBtZXNzYWdlID0gbnVsbCkgPT4ge1xyXG4gICAgICAgIGlmIChtZXNzYWdlKSB7XHJcbiAgICAgICAgICAgIGNvdW50ZXJFbGVtZW50LnRleHRDb250ZW50ID0gbWVzc2FnZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb3VudGVyRWxlbWVudC50ZXh0Q29udGVudCA9IGDQodGC0LDRgtGD0YE6ICR7Y3VycmVudH0vJHttYXh9YDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIG1pbmVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoZXZlbnQpID0+IHtcclxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuICAgICAgICBpZiAoaXNNaW5pbmcpIHsgbG9nV2FybignTWluaW5nIHByb2Nlc3MgYWxyZWFkeSBydW5uaW5nLicpOyByZXR1cm47IH1cclxuICAgICAgICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHsgYWxlcnQoJ9Ca0L7QvdGC0LXQutGB0YIg0YDQsNGB0YjQuNGA0LXQvdC40Y8g0L3QtdC00LXQudGB0YLQstC40YLQtdC70LXQvS4nKTsgcmV0dXJuOyB9XHJcbiAgICAgICAgaWYgKCFjc3JmVG9rZW4pIHsgYWxlcnQoJ0NTUkYg0YLQvtC60LXQvSDQvdC1INC90LDQudC00LXQvS4nKTsgbG9nRXJyb3IoJ01pbmluZyBzdGFydCBibG9ja2VkOiBDU1JGIHRva2VuIGlzIG51bGwgb3IgZW1wdHkuJyk7IHJldHVybjsgfVxyXG5cclxuICAgICAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRIaXRzQ291bnQgPSBjdXJyZW50U2V0dGluZ3MubWluZUhpdENvdW50O1xyXG5cclxuICAgICAgICB1cGRhdGVCdXR0b25TdGF0ZSh0cnVlKTtcclxuICAgICAgICB1cGRhdGVDb3VudGVyKDAsIGN1cnJlbnRIaXRzQ291bnQsIGDQntGC0L/RgNCw0LLQutCwICR7Y3VycmVudEhpdHNDb3VudH0g0YPQtNCw0YDQvtCyLi4uYCk7XHJcbiAgICAgICAgbG9nKCdTdGFydGluZyBtaW5pbmcgYnVyc3QgZnJvbSBidXR0b24gY2xpY2suLi4nKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgc3RhcnRNaW5pbmdQcm9jZXNzKHVwZGF0ZUJ1dHRvblN0YXRlLCB1cGRhdGVDb3VudGVyKTtcclxuICAgICAgICAgICAgbG9nKCdzdGFydE1pbmluZ1Byb2Nlc3MgKGJ1cnN0KSBmaW5pc2hlZC4nKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBsb2dFcnJvcignQ3JpdGljYWwgZXJyb3IgZHVyaW5nIHN0YXJ0TWluaW5nUHJvY2VzcyAoYnVyc3QpIGV4ZWN1dGlvbjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIHVwZGF0ZUJ1dHRvblN0YXRlKGZhbHNlKTtcclxuICAgICAgICAgICAgdXBkYXRlQ291bnRlcigwLCBjdXJyZW50SGl0c0NvdW50LCAn4p2MINCa0YDQuNGC0LjRh9C10YHQutCw0Y8g0L7RiNC40LHQutCwJyk7XHJcbiAgICAgICAgICAgIGFsZXJ0KGDQn9GA0L7QuNC30L7RiNC70LAg0LrRgNC40YLQuNGH0LXRgdC60LDRjyDQvtGI0LjQsdC60LAg0LLQviDQstGA0LXQvNGPINC00L7QsdGL0YfQuDogJHtlcnJvci5tZXNzYWdlIHx8ICfQodC8LiDQutC+0L3RgdC+0LvRjC4nfWApO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxvZygnTWluZSBidXR0b24gY2xpY2sgaGFuZGxlciAoYnVyc3QgbW9kZSkgc2V0LicpO1xyXG59O1xyXG5cclxuXHJcbmNvbnN0IGluaXRQYWdlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7XHJcbiAgICAgICAgbG9nV2FybignRXh0ZW5zaW9uIGNvbnRleHQgaXMgbm90IHZhbGlkLiBBYm9ydGluZyBpbml0aWFsaXphdGlvbi4nKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBsb2coJ1N0YXJ0aW5nIHBhZ2UgaW5pdGlhbGl6YXRpb24uLi4nKTtcclxuXHJcbiAgICBhZGRFeHRlbnNpb25TZXR0aW5nc0J1dHRvbigpO1xyXG5cclxuICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcclxuICAgIGxvZygnU2V0dGluZ3MgbG9hZGVkIGluIGluaXRQYWdlOicsIHNldHRpbmdzKTtcclxuXHJcbiAgICBpZiAoIXNldHRpbmdzLmV4dGVuc2lvbkVuYWJsZWQpIHtcclxuICAgICAgICBsb2coJ0V4dGVuc2lvbiBpcyBnbG9iYWxseSBkaXNhYmxlZCB2aWEgc2V0dGluZ3MuIEluaXRpYWxpemF0aW9uIHN0b3BwZWQuJyk7XHJcbiAgICAgICAgY2xlYW51cEV4dGVuc2lvbkZlYXR1cmVzKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGxvZygnRXh0ZW5zaW9uIGlzIGVuYWJsZWQsIHByb2NlZWRpbmcgd2l0aCBpbml0aWFsaXphdGlvbi4nKTtcclxuICAgIGNvbnN0IHRva2VuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPVwiY3NyZi10b2tlblwiXScpPy5nZXRBdHRyaWJ1dGUoJ2NvbnRlbnQnKSB8fCAnJztcclxuICAgIGlmICh0b2tlbikge1xyXG4gICAgICAgIHNldENzcmZUb2tlbih0b2tlbik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxvZ1dhcm4oJ0NTUkYgdG9rZW4gbWV0YSB0YWcgbm90IGZvdW5kIScpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRleHQgPSBnZXRDdXJyZW50Q29udGV4dCgpO1xyXG4gICAgbG9nKCdDdXJyZW50IGNvbnRleHQgZGV0ZWN0ZWQ6JywgY29udGV4dCk7XHJcblxyXG4gICAgaWYgKGNvbnRleHQgPT09ICdxdWl6UGFnZScpIHtcclxuICAgICAgICAgbG9nKCdDb250ZXh0IGlzIHF1aXpQYWdlLCBjYWxsaW5nIGFkZFF1aXpCdXR0b24uLi4nKTtcclxuICAgICAgICAgYXdhaXQgYWRkUXVpekJ1dHRvbigpO1xyXG4gICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSAnbWluZVBhZ2UnKSB7XHJcbiAgICAgICAgIGxvZygnQ29udGV4dCBpcyBtaW5lUGFnZSwgY2FsbGluZyBpbml0TWluZVBhZ2UuLi4nKTtcclxuICAgICAgICAgYXdhaXQgaW5pdE1pbmVQYWdlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFjb250ZXh0KSB7XHJcbiAgICAgICAgbG9nKCdObyBzcGVjaWZpYyBjb250ZXh0IGRldGVjdGVkLiBJbml0aWFsaXphdGlvbiBmaW5pc2hlZC4nKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvbnRleHQgIT09ICdxdWl6UGFnZScgJiYgY29udGV4dCAhPT0gJ21pbmVQYWdlJykge1xyXG4gICAgICAgIGxvZyhgSW5pdGlhbGl6aW5nIGNvbnRleHQ6ICR7Y29udGV4dH1gKTtcclxuICAgICAgICBsZXQgZWZmZWN0aXZlSW5pdGlhbENvbnRleHRTdGF0ZSA9IHt9O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgdXNlckNvbnRleHRTdGF0ZXMgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0KFsndXNlckNvbnRleHRTdGF0ZXMnXSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNhdmVkU3RhdGVzID0gdXNlckNvbnRleHRTdGF0ZXMgfHwge307XHJcbiAgICAgICAgICAgIGVmZmVjdGl2ZUluaXRpYWxDb250ZXh0U3RhdGUgPSB7XHJcbiAgICAgICAgICAgICAgICAuLi4oaW5pdGlhbENvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCB7fSksXHJcbiAgICAgICAgICAgICAgICAuLi4oc2F2ZWRTdGF0ZXNbY29udGV4dF0gfHwge30pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNvbnRleHRTdGF0ZSA9IHsgLi4uY29udGV4dFN0YXRlLCBbY29udGV4dF06IHsgLi4uZWZmZWN0aXZlSW5pdGlhbENvbnRleHRTdGF0ZSB9IH07XHJcbiAgICAgICAgICAgIGxvZyhgQ3VycmVudCBnbG9iYWwgY29udGV4dFN0YXRlIGFmdGVyIGluaXQ6YCwgY29udGV4dFN0YXRlKTtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgc3dpdGNoIChjb250ZXh0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICd1c2VyQ2FyZHMnOiBhd2FpdCBpbml0VXNlckNhcmRzKCk7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbWFya2V0Q3JlYXRlJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBpbml0U3RhdHNCdXR0b25zKGNvbnRleHQsICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGhhbmRsZU1hcmtldENyZWF0ZVBhZ2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RyYWRlJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IHx8IGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ud2lzaGxpc3QgfHwgc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycyB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lm93bmVycykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZWRFbGVtZW50cy5kZWxldGUoY29udGV4dHNTZWxlY3RvcnMudHJhZGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoJ3RyYWRlJywgc2V0dGluZ3MpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3BhY2snOiBhd2FpdCBpbml0UGFja1BhZ2UoKTsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdkZWNrVmlldyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IHx8IGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ud2lzaGxpc3QgfHwgc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycyB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lm93bmVycykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzLmRlY2tWaWV3KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHByb2Nlc3NDYXJkcygnZGVja1ZpZXcnLCBzZXR0aW5ncyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RyYWRlT2ZmZXInOiBhd2FpdCBpbml0U3RhdHNCdXR0b25zKGNvbnRleHQsICcudHJhZGVfX3Jhbmstd3JhcHBlciAudHJhZGVfX3JhbmsnLCAndHJhZGVfX3R5cGUtY2FyZC1idXR0b24nKTsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdyZW1lbHQnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbWFya2V0JzpcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3NwbGl0JzpcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2RlY2tDcmVhdGUnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbWFya2V0UmVxdWVzdENyZWF0ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgaW5pdFN0YXRzQnV0dG9ucyhjb250ZXh0LCAnLmNhcmQtZmlsdGVyLWZvcm1fX2xvY2stc3RhdHVzJywgJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ21hcmtldFJlcXVlc3RWaWV3JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgfHwgY29udGV4dFN0YXRlW2NvbnRleHRdPy53aXNobGlzdCB8fCBzZXR0aW5ncy5hbHdheXNTaG93T3duZXJzIHx8IGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ub3duZXJzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKGBQcm9jZXNzaW5nIGNhcmRzIGZvciAke2NvbnRleHR9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzW2NvbnRleHRdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoY29udGV4dCwgc2V0dGluZ3MpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBsb2dXYXJuKGBObyBzcGVjaWZpYyBpbml0aWFsaXphdGlvbiBsb2dpYyBmb3IgY29udGV4dDogJHtjb250ZXh0fWApO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHsgbG9nRXJyb3IoYEVycm9yIGR1cmluZyBjb250ZXh0IGluaXRpYWxpemF0aW9uIGZvciAke2NvbnRleHR9OmAsIGVycm9yKTsgfVxyXG5cclxuICAgICAgICAgICAgaW5pdGlhbGl6ZU9ic2VydmVyKGNvbnRleHQpO1xyXG5cclxuICAgICAgICAgICAgbG9nKCdQYWdlIGluaXRpYWxpemF0aW9uIGZpbmlzaGVkIGZvciBjb250ZXh0OicsIGNvbnRleHQpO1xyXG4gICAgICAgIH0gY2F0Y2ggKHN0b3JhZ2VFcnJvcikge1xyXG4gICAgICAgICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHNldHRpbmdzIG9yIHVzZXJDb250ZXh0U3RhdGVzIGR1cmluZyBpbml0UGFnZTonLCBzdG9yYWdlRXJyb3IpO1xyXG4gICAgICAgICAgICAgY29udGV4dFN0YXRlID0geyAuLi5jb250ZXh0U3RhdGUsIFtjb250ZXh0XTogeyAuLi4oaW5pdGlhbENvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCB7fSkgfSB9O1xyXG4gICAgICAgICAgICAgbG9nV2FybihgSW5pdGlhbGl6ZWQgJHtjb250ZXh0fSB3aXRoIGRlZmF1bHQgc3RhdGUgZHVlIHRvIHN0b3JhZ2UgZXJyb3IuYCk7XHJcbiAgICAgICAgICAgICBsb2coYEN1cnJlbnQgZ2xvYmFsIGNvbnRleHRTdGF0ZSBhZnRlciBzdG9yYWdlIGVycm9yOmAsIGNvbnRleHRTdGF0ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBsb2coYEluaXRpYWxpemF0aW9uIGZvciBjb250ZXh0ICcke2NvbnRleHR9JyBmaW5pc2hlZCAoYWRkZWQgYnV0dG9ucy9lbGVtZW50cykuYCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5pZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKSB7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgaW5pdFBhZ2UpO1xyXG59IGVsc2Uge1xyXG4gICAgaW5pdFBhZ2UoKTtcclxufVxyXG5cclxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xyXG4gICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7IGxvZ1dhcm4oJ1JlY2VpdmVkIG1lc3NhZ2UsIGJ1dCBleHRlbnNpb24gY29udGV4dCBpcyBpbnZhbGlkLicpOyByZXR1cm4gZmFsc2U7IH1cclxuICAgIGxvZyhgUmVjZWl2ZWQgbWVzc2FnZTogJHttZXNzYWdlLmFjdGlvbn1gLCBtZXNzYWdlKTtcclxuXHJcbiAgICBpZiAobWVzc2FnZS5hY3Rpb24gPT09ICdjbGVhcldpc2hsaXN0Q2FjaGUnKSB7XHJcbiAgICAgICAgbG9nKCdQcm9jZXNzaW5nIGNsZWFyV2lzaGxpc3RDYWNoZSBtZXNzYWdlLi4uJyk7XHJcbiAgICAgICAgY2FjaGVkRWxlbWVudHMuY2xlYXIoKTtcclxuICAgICAgICBwZW5kaW5nUmVxdWVzdHMuY2xlYXIoKTtcclxuICAgICAgICBnZXRTZXR0aW5ncygpLnRoZW4oc2V0dGluZ3MgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc2V0dGluZ3MuZXh0ZW5zaW9uRW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGdldEN1cnJlbnRDb250ZXh0KCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSAmJiBjb250ZXh0ICE9PSAncXVpelBhZ2UnICYmIGNvbnRleHQgIT09ICdtaW5lUGFnZScpIHtcclxuICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZExhYmVscyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy53aXNobGlzdC13YXJuaW5nLCAub3duZXJzLWNvdW50Jyk7XHJcbiAgICAgICAgICAgICAgICAgICBvbGRMYWJlbHMuZm9yRWFjaChsYWJlbCA9PiBsYWJlbC5yZW1vdmUoKSk7XHJcbiAgICAgICAgICAgICAgICAgICBsb2coYFJlbW92ZWQgJHtvbGRMYWJlbHMubGVuZ3RofSBvbGQgbGFiZWxzLmApO1xyXG4gICAgICAgICAgICAgICAgICAgbG9nKCdSZXByb2Nlc3NpbmcgY29udGV4dCBhZnRlciBjYWNoZSBjbGVhci4uLicpO1xyXG4gICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFN0YXRlID0gY29udGV4dFN0YXRlW2NvbnRleHRdIHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgY29uc3QgZWZmZWN0aXZlU3RhdGUgPSB7IC4uLihpbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdIHx8IHt9KSwgLi4uY3VycmVudFN0YXRlIH07XHJcbiAgICAgICAgICAgICAgICAgICBjb250ZXh0U3RhdGUgPSB7IC4uLmNvbnRleHRTdGF0ZSwgW2NvbnRleHRdOiBlZmZlY3RpdmVTdGF0ZSB9O1xyXG4gICAgICAgICAgICAgICAgICAgaWYgKGNvbnRleHQgPT09ICd1c2VyQ2FyZHMnKSB7IGluaXRVc2VyQ2FyZHMoKTsgfVxyXG4gICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoWyd0cmFkZU9mZmVyJywgJ3JlbWVsdCcsICdtYXJrZXQnLCAnc3BsaXQnLCAnZGVja0NyZWF0ZScsICdtYXJrZXRDcmVhdGUnLCAnbWFya2V0UmVxdWVzdENyZWF0ZSddLmluY2x1ZGVzKGNvbnRleHQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidXR0b25Db25maWdNYXAgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAndHJhZGVPZmZlcic6IHsgc2VsZWN0b3I6ICcudHJhZGVfX3Jhbmstd3JhcHBlciAudHJhZGVfX3JhbmsnLCBjbGFzczogJ3RyYWRlX190eXBlLWNhcmQtYnV0dG9uJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3JlbWVsdCc6IHsgc2VsZWN0b3I6ICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCBjbGFzczogJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnbWFya2V0JzogeyBzZWxlY3RvcjogJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsIGNsYXNzOiAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICdzcGxpdCc6IHsgc2VsZWN0b3I6ICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCBjbGFzczogJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnZGVja0NyZWF0ZSc6IHsgc2VsZWN0b3I6ICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCBjbGFzczogJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnbWFya2V0Q3JlYXRlJzogeyBzZWxlY3RvcjogJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsIGNsYXNzOiAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICdtYXJrZXRSZXF1ZXN0Q3JlYXRlJzogeyBzZWxlY3RvcjogJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsIGNsYXNzOiAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidXR0b25Db25maWcgPSBidXR0b25Db25maWdNYXBbY29udGV4dF07XHJcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoYnV0dG9uQ29uZmlnKSB7IGluaXRTdGF0c0J1dHRvbnMoY29udGV4dCwgYnV0dG9uQ29uZmlnLnNlbGVjdG9yLCBidXR0b25Db25maWcuY2xhc3MpOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgbG9nV2FybihgQnV0dG9uIGNvbmZpZyBub3QgZm91bmQgZm9yICR7Y29udGV4dH0uLi5gKTsgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIHNldHRpbmdzKTsgfVxyXG4gICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSAncGFjaycpIHsgaW5pdFBhY2tQYWdlKCk7IH1cclxuICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbnRleHQgPT09ICd0cmFkZScgfHwgY29udGV4dCA9PT0gJ2RlY2tWaWV3JyB8fCBjb250ZXh0ID09PSAnbWFya2V0UmVxdWVzdFZpZXcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZEVsZW1lbnRzLmRlbGV0ZShjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2Nlc3NDYXJkcyhjb250ZXh0LCBzZXR0aW5ncyk7XHJcbiAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICBlbHNlIHsgbG9nV2FybihgVW5oYW5kbGVkIGNvbnRleHQgJHtjb250ZXh0fSBpbiBjbGVhciBjYWNoZSByZXByb2Nlc3NpbmcuYCk7IH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbG9nKGBObyBhY3RpdmUgY29udGV4dCByZXF1aXJpbmcgY2FyZCByZXByb2Nlc3NpbmcgYWZ0ZXIgY2FjaGUgY2xlYXIuIEN1cnJlbnQgY29udGV4dDogJHtjb250ZXh0fWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgIGxvZygnQ2FjaGUgY2xlYXJlZCwgYnV0IGV4dGVuc2lvbiBpcyBnbG9iYWxseSBkaXNhYmxlZC4gTm8gcmVwcm9jZXNzaW5nIG5lZWRlZC4nKTtcclxuICAgICAgICAgICAgICAgICBjb25zdCBvbGRMYWJlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcud2lzaGxpc3Qtd2FybmluZywgLm93bmVycy1jb3VudCcpO1xyXG4gICAgICAgICAgICAgICAgIG9sZExhYmVscy5mb3JFYWNoKGxhYmVsID0+IGxhYmVsLnJlbW92ZSgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IGxvZ0Vycm9yKCdFcnJvciBnZXR0aW5nIHNldHRpbmdzIGR1cmluZyBjYWNoZSBjbGVhcjonLCBlcnJvcikpO1xyXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN0YXR1czogJ2NhY2hlX2NsZWFyZWRfb25fcGFnZScgfSk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3RhdHVzOiAndW5rbm93bl9hY3Rpb25fb25fcGFnZScsIHJlY2VpdmVkOiBtZXNzYWdlLmFjdGlvbiB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG59KTtcclxuXHJcbmNocm9tZS5zdG9yYWdlLm9uQ2hhbmdlZC5hZGRMaXN0ZW5lcihhc3luYyAoY2hhbmdlcywgbmFtZXNwYWNlKSA9PiB7XHJcbiAgICBpZiAobmFtZXNwYWNlID09PSAnc3luYycpIHtcclxuICAgICAgICBsb2coJ0RldGVjdGVkIGNoYW5nZSBpbiBzeW5jIHNldHRpbmdzOicsIGNoYW5nZXMpO1xyXG4gICAgICAgIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgeyBsb2dXYXJuKCdTZXR0aW5ncyBjaGFuZ2VkLCBidXQgY29udGV4dCBpbnZhbGlkLi4uJyk7IHJldHVybjsgfVxyXG5cclxuICAgICAgICBpZiAoY2hhbmdlcy5leHRlbnNpb25FbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld1ZhbHVlID0gY2hhbmdlcy5leHRlbnNpb25FbmFibGVkLm5ld1ZhbHVlO1xyXG4gICAgICAgICAgICBsb2coYEdsb2JhbCBlbmFibGUgc3dpdGNoIGNoYW5nZWQgdG86ICR7bmV3VmFsdWV9YCk7XHJcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgaW5pdFBhZ2UoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNsZWFudXBFeHRlbnNpb25GZWF0dXJlcygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgY2hhbmdlZEtleXMgPSBPYmplY3Qua2V5cyhjaGFuZ2VzKTtcclxuICAgICAgICAgICAgY29uc3QgcmVsZXZhbnRLZXlzID0gWyd3aXNobGlzdFN0eWxlJywgJ3dpc2hsaXN0V2FybmluZycsICdhbHdheXNTaG93V2lzaGxpc3QnLCAnYWx3YXlzU2hvd093bmVycycsICd1c2VyQ29udGV4dFN0YXRlcycsICdtaW5lSGl0Q291bnQnXTtcclxuICAgICAgICAgICAgY29uc3Qgb3RoZXJTZXR0aW5nc0NoYW5nZWQgPSBjaGFuZ2VkS2V5cy5zb21lKGtleSA9PiByZWxldmFudEtleXMuaW5jbHVkZXMoa2V5KSk7XHJcblxyXG4gICAgICAgICAgICBpZiAob3RoZXJTZXR0aW5nc0NoYW5nZWQpIHtcclxuICAgICAgICAgICAgICAgICBsb2coJ0RldGVjdGVkIGNoYW5nZSBpbiBvdGhlciByZWxldmFudCBzeW5jIHNldHRpbmdzLicpO1xyXG4gICAgICAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuZXh0ZW5zaW9uRW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICBsb2coJ0V4dGVuc2lvbiBpcyBlbmFibGVkLCByZS1pbml0aWFsaXppbmcgZHVlIHRvIHNldHRpbmcgY2hhbmdlLicpO1xyXG4gICAgICAgICAgICAgICAgICAgICBhd2FpdCBpbml0UGFnZSgpO1xyXG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBsb2coJ090aGVyIHNldHRpbmdzIGNoYW5nZWQsIGJ1dCBleHRlbnNpb24gaXMgZGlzYWJsZWQuIE5vIGFjdGlvbiBuZWVkZWQuJyk7XHJcbiAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgeyBsb2csIGxvZ1dhcm4sIGxvZ0Vycm9yLCBpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCB9IGZyb20gJy4vdXRpbHMuanMnO1xyXG5pbXBvcnQgeyBjc3JmVG9rZW4gfSBmcm9tICcuL2FwaS5qcyc7XHJcbmltcG9ydCB7IGdldFNldHRpbmdzIH0gZnJvbSAnLi9zZXR0aW5ncy5qcyc7IFxyXG5cclxuY29uc3QgTUlORV9ISVRfVVJMID0gXCJodHRwczovL21hbmdhYnVmZi5ydS9taW5lL2hpdFwiO1xyXG5cclxuY29uc3Qgc2VuZE1pbmVIaXRSZXF1ZXN0ID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB0aHJvdyBuZXcgRXJyb3IoXCJFeHRlbnNpb24gY29udGV4dCBsb3N0XCIpO1xyXG4gICAgaWYgKCFjc3JmVG9rZW4pIHRocm93IG5ldyBFcnJvcihcIkNTUkYgdG9rZW4gaXMgbWlzc2luZ1wiKTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGFjdGlvbjogJ21pbmVIaXQnLFxyXG4gICAgICAgICAgICB1cmw6IE1JTkVfSElUX1VSTCxcclxuICAgICAgICAgICAgY3NyZlRva2VuOiBjc3JmVG9rZW5cclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAoIXJlc3BvbnNlKSB7IHRocm93IG5ldyBFcnJvcihgTm8gcmVzcG9uc2UgcmVjZWl2ZWQuLi5gKTsgfVxyXG4gICAgICAgIGlmICghcmVzcG9uc2Uuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnVW5rbm93biBiYWNrZ3JvdW5kIGVycm9yJyk7XHJcbiAgICAgICAgICAgIGVycm9yLnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcclxuICAgICAgICAgICAgZXJyb3IuZGF0YSA9IHJlc3BvbnNlLmRhdGE7XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgbG9nRXJyb3IoYEVycm9yIHNlbmRpbmcgbWVzc2FnZSBmb3IgYWN0aW9uIG1pbmVIaXQ6YCwgZXJyb3IpO1xyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHN0YXJ0TWluaW5nUHJvY2VzcyA9IGFzeW5jICh1cGRhdGVCdXR0b25TdGF0ZUNhbGxiYWNrLCB1cGRhdGVDb3VudGVyQ2FsbGJhY2spID0+IHtcclxuXHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgICBjb25zdCBoaXRzVG9TZW5kID0gc2V0dGluZ3MubWluZUhpdENvdW50OyBcclxuXHJcbiAgICBsb2coYPCfmoAgU3RhcnRpbmcgbWluaW5nIGJ1cnN0IG9mICR7aGl0c1RvU2VuZH0gaGl0cy4uLmApO1xyXG5cclxuICAgIHVwZGF0ZUNvdW50ZXJDYWxsYmFjaygwLCBoaXRzVG9TZW5kLCBg0J7RgtC/0YDQsNCy0LrQsCAke2hpdHNUb1NlbmR9INGD0LTQsNGA0L7Qsi4uLmApO1xyXG4gICAgdXBkYXRlQnV0dG9uU3RhdGVDYWxsYmFjayh0cnVlKTtcclxuXHJcbiAgICBjb25zdCBoaXRQcm9taXNlcyA9IFtdO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBoaXRzVG9TZW5kOyBpKyspIHsgXHJcbiAgICAgICAgaGl0UHJvbWlzZXMucHVzaChzZW5kTWluZUhpdFJlcXVlc3QoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgbG9nKGBJbml0aWF0ZWQgJHtoaXRQcm9taXNlcy5sZW5ndGh9IGhpdCByZXF1ZXN0cy5gKTtcclxuXHJcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGhpdFByb21pc2VzKTtcclxuICAgIGxvZyhgRmluaXNoZWQgcHJvY2Vzc2luZyBhbGwgJHtyZXN1bHRzLmxlbmd0aH0gaGl0IHJlcXVlc3RzLmApO1xyXG5cclxuICAgIGxldCBzdWNjZXNzZnVsSGl0cyA9IDA7XHJcbiAgICBsZXQgZmlyc3RFcnJvck1lc3NhZ2UgPSBudWxsO1xyXG4gICAgbGV0IHJhdGVMaW1pdEhpdCA9IGZhbHNlO1xyXG5cclxuICAgIHJlc3VsdHMuZm9yRWFjaCgocmVzdWx0LCBpbmRleCkgPT4ge1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJykge1xyXG4gICAgICAgICAgICBzdWNjZXNzZnVsSGl0cysrO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxvZ1dhcm4oYOKdjCBIaXQgJHtpbmRleCArIDF9IGZhaWxlZC4gUmVhc29uOmAsIHJlc3VsdC5yZWFzb24/Lm1lc3NhZ2UgfHwgcmVzdWx0LnJlYXNvbik7XHJcbiAgICAgICAgICAgIGlmICghZmlyc3RFcnJvck1lc3NhZ2UpIHtcclxuICAgICAgICAgICAgICAgIGZpcnN0RXJyb3JNZXNzYWdlID0gcmVzdWx0LnJlYXNvbj8ubWVzc2FnZSB8fCAn0J3QtdC40LfQstC10YHRgtC90LDRjyDQvtGI0LjQsdC60LAnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQucmVhc29uPy5zdGF0dXMgPT09IDQwMyB8fCByZXN1bHQucmVhc29uPy5zdGF0dXMgPT09IDQyOSB8fCByZXN1bHQucmVhc29uPy5tZXNzYWdlPy5pbmNsdWRlcygnY2xvc2VkJykgfHwgcmVzdWx0LnJlYXNvbj8ubWVzc2FnZT8uaW5jbHVkZXMoJ9C30LDQutGA0YvRgtCwJykpIHtcclxuICAgICAgICAgICAgICAgICByYXRlTGltaXRIaXQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbG9nKGDwn5OKIE1pbmluZyBidXJzdCByZXN1bHQ6ICR7c3VjY2Vzc2Z1bEhpdHN9IHN1Y2Nlc3NmdWwgLyAke2hpdHNUb1NlbmQgLSBzdWNjZXNzZnVsSGl0c30gZmFpbGVkLmApOyBcclxuXHJcbiAgICBsZXQgZmluYWxNZXNzYWdlID0gJyc7XHJcbiAgICBpZiAoc3VjY2Vzc2Z1bEhpdHMgPT09IGhpdHNUb1NlbmQpIHsgXHJcbiAgICAgICAgZmluYWxNZXNzYWdlID0gYOKclO+4jyDQo9GB0L/QtdGI0L3QviAoJHtzdWNjZXNzZnVsSGl0c30vJHtoaXRzVG9TZW5kfSlgOyBcclxuICAgIH0gZWxzZSBpZiAocmF0ZUxpbWl0SGl0KSB7XHJcbiAgICAgICAgZmluYWxNZXNzYWdlID0gYOKdjCDQqNCw0YXRgtCwINC30LDQutGA0YvRgtCwICgke3N1Y2Nlc3NmdWxIaXRzfS8ke2hpdHNUb1NlbmR9KWA7IFxyXG4gICAgfSBlbHNlIGlmIChzdWNjZXNzZnVsSGl0cyA+IDApIHtcclxuICAgICAgICBmaW5hbE1lc3NhZ2UgPSBg4pqg77iPINCn0LDRgdGC0LjRh9C90L4gKCR7c3VjY2Vzc2Z1bEhpdHN9LyR7aGl0c1RvU2VuZH0pLiDQntGI0LjQsdC60LA6ICR7Zmlyc3RFcnJvck1lc3NhZ2V9YDsgXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZpbmFsTWVzc2FnZSA9IGDinYwg0J7RiNC40LHQutCwICgke3N1Y2Nlc3NmdWxIaXRzfS8ke2hpdHNUb1NlbmR9KTogJHtmaXJzdEVycm9yTWVzc2FnZX1gOyBcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGVCdXR0b25TdGF0ZUNhbGxiYWNrKGZhbHNlKTtcclxuICAgIHVwZGF0ZUNvdW50ZXJDYWxsYmFjayhzdWNjZXNzZnVsSGl0cywgaGl0c1RvU2VuZCwgZmluYWxNZXNzYWdlKTsgXHJcbn07IiwiaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGRlYm91bmNlLCBsb2csIGxvZ1dhcm4sIGNhY2hlZEVsZW1lbnRzIH0gZnJvbSAnLi91dGlscy5qcyc7XHJcbmltcG9ydCB7IGNvbnRleHRzU2VsZWN0b3JzLCBnZXRDdXJyZW50Q29udGV4dCB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tICcuL3NldHRpbmdzLmpzJztcclxuaW1wb3J0IHsgcHJvY2Vzc0NhcmRzIH0gZnJvbSAnLi9jYXJkUHJvY2Vzc29yLmpzJztcclxuaW1wb3J0IHsgaW5pdFVzZXJDYXJkcyB9IGZyb20gJy4vY29udGV4dEhhbmRsZXJzLmpzJztcclxuaW1wb3J0IHsgY29udGV4dFN0YXRlIH0gZnJvbSAnLi9tYWluLmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBzZXR1cE9ic2VydmVyID0gKGNvbnRleHQsIG9ic2VydmVyQ3JlYXRlZENhbGxiYWNrKSA9PiB7XHJcbiAgaWYgKCFjb250ZXh0IHx8ICFjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSkge1xyXG4gICAgbG9nV2FybihgT2JzZXJ2ZXI6IE5vdCBzZXQgdXAgLSBpbnZhbGlkIGNvbnRleHQgb3Igbm8gc2VsZWN0b3IgZGVmaW5lZDogJHtjb250ZXh0fWApO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgbGV0IHRhcmdldFNlbGVjdG9yO1xyXG4gIHN3aXRjaCAoY29udGV4dCkge1xyXG4gICAgICBjYXNlICd0cmFkZU9mZmVyJzogdGFyZ2V0U2VsZWN0b3IgPSAnLnRyYWRlX19pbnZlbnRvcnktbGlzdCc7IGJyZWFrO1xyXG4gICAgICBjYXNlICdwYWNrJzogcmV0dXJuO1xyXG4gICAgICBjYXNlICdkZWNrVmlldyc6IHRhcmdldFNlbGVjdG9yID0gJy5kZWNrX19pdGVtcyc7IGJyZWFrO1xyXG4gICAgICBjYXNlICd1c2VyQ2FyZHMnOiB0YXJnZXRTZWxlY3RvciA9ICcubWFuZ2EtY2FyZHMnOyBicmVhaztcclxuICAgICAgY2FzZSAndHJhZGUnOiB0YXJnZXRTZWxlY3RvciA9ICcudHJhZGVfX21haW4nOyBicmVhaztcclxuICAgICAgY2FzZSAncmVtZWx0JzpcclxuICAgICAgY2FzZSAnbWFya2V0JzpcclxuICAgICAgY2FzZSAnc3BsaXQnOlxyXG4gICAgICBjYXNlICdkZWNrQ3JlYXRlJzpcclxuICAgICAgY2FzZSAnbWFya2V0Q3JlYXRlJzpcclxuICAgICAgY2FzZSAnbWFya2V0UmVxdWVzdENyZWF0ZSc6IHRhcmdldFNlbGVjdG9yID0gJy5jYXJkLWZpbHRlci1saXN0X19pdGVtcyc7IGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgbG9nV2FybihgT2JzZXJ2ZXI6IE5vIHRhcmdldCBzZWxlY3RvciBkZWZpbmVkIGZvciBjb250ZXh0ICR7Y29udGV4dH0uYCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCB0YXJnZXROb2RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0YXJnZXRTZWxlY3Rvcik7XHJcbiAgaWYgKCF0YXJnZXROb2RlKSB7XHJcbiAgICAgIGxvZ1dhcm4oYE9ic2VydmVyOiBUYXJnZXQgbm9kZSBub3QgZm91bmQgd2l0aCBzZWxlY3RvcjogJHt0YXJnZXRTZWxlY3Rvcn0gZm9yIGNvbnRleHQgJHtjb250ZXh0fWApO1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgIGNvbnN0IGRlbGF5ZWROb2RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0YXJnZXRTZWxlY3Rvcik7XHJcbiAgICAgICAgICBpZiAoZGVsYXllZE5vZGUpIHtcclxuICAgICAgICAgICAgICBsb2coYE9ic2VydmVyOiBUYXJnZXQgbm9kZSAke3RhcmdldFNlbGVjdG9yfSBmb3VuZCBhZnRlciBkZWxheS4gU2V0dGluZyB1cCBvYnNlcnZlci5gKTtcclxuICAgICAgICAgICAgICBvYnNlcnZlTm9kZShkZWxheWVkTm9kZSwgY29udGV4dCwgb2JzZXJ2ZXJDcmVhdGVkQ2FsbGJhY2spO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBsb2dXYXJuKGBPYnNlcnZlcjogVGFyZ2V0IG5vZGUgJHt0YXJnZXRTZWxlY3Rvcn0gc3RpbGwgbm90IGZvdW5kIGFmdGVyIGRlbGF5LmApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICB9LCAxMDAwKTtcclxuICAgICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgb2JzZXJ2ZU5vZGUodGFyZ2V0Tm9kZSwgY29udGV4dCwgb2JzZXJ2ZXJDcmVhdGVkQ2FsbGJhY2spO1xyXG59O1xyXG5cclxuY29uc3Qgb2JzZXJ2ZU5vZGUgPSAodGFyZ2V0Tm9kZSwgY29udGV4dCwgb2JzZXJ2ZXJDcmVhdGVkQ2FsbGJhY2spID0+IHtcclxuICAgIGNvbnN0IG9ic2VydmVyQ2FsbGJhY2sgPSBkZWJvdW5jZShhc3luYyAobXV0YXRpb25zKSA9PiB7XHJcbiAgICAgICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7XHJcbiAgICAgICAgICAgIGxvZ1dhcm4oJ09ic2VydmVyOiBFeHRlbnNpb24gY29udGV4dCBsb3N0LCBza2lwcGluZyBtdXRhdGlvbiBwcm9jZXNzaW5nLicpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY2FyZExpc3RDaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgY2FyZFNlbGVjdG9yID0gY29udGV4dHNTZWxlY3RvcnNbY29udGV4dF07XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgbXV0YXRpb24gb2YgbXV0YXRpb25zKSB7XHJcbiAgICAgICAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hpbGRMaXN0Jykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWRkZWROb2Rlc01hdGNoID0gQXJyYXkuZnJvbShtdXRhdGlvbi5hZGRlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5tYXRjaGVzPy4oY2FyZFNlbGVjdG9yKSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVkTm9kZXNNYXRjaCA9IEFycmF5LmZyb20obXV0YXRpb24ucmVtb3ZlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5tYXRjaGVzPy4oY2FyZFNlbGVjdG9yKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGFkZGVkTm9kZXNNYXRjaCB8fCByZW1vdmVkTm9kZXNNYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRMaXN0Q2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dCA9PT0gJ3VzZXJDYXJkcycgJiYgKG11dGF0aW9uLnRhcmdldCA9PT0gdGFyZ2V0Tm9kZSB8fCBtdXRhdGlvbi50YXJnZXQuY2xvc2VzdCh0YXJnZXRTZWxlY3RvcikpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGlmIChtdXRhdGlvbi5hZGRlZE5vZGVzLmxlbmd0aCA+IDAgfHwgbXV0YXRpb24ucmVtb3ZlZE5vZGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGNhcmRMaXN0Q2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgIGlmIChjb250ZXh0ID09PSAndHJhZGUnICYmIG11dGF0aW9uLnRhcmdldCA9PT0gdGFyZ2V0Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICBpZiAobXV0YXRpb24uYWRkZWROb2Rlcy5sZW5ndGggPiAwIHx8IG11dGF0aW9uLnJlbW92ZWROb2Rlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBjYXJkTGlzdENoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjYXJkTGlzdENoYW5nZWQpIHtcclxuICAgICAgICAgICAgbG9nKGBPYnNlcnZlcjogRGV0ZWN0ZWQgY2FyZCBsaXN0IGNoYW5nZSBpbiBjb250ZXh0OiAke2NvbnRleHR9LiBSZXByb2Nlc3NpbmcuYCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoY29udGV4dCA9PT0gJ3VzZXJDYXJkcycpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGluaXRVc2VyQ2FyZHMoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgbmVlZHNQcm9jZXNzaW5nID0gKGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ud2lzaGxpc3QgfHwgY3VycmVudFNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfHwgKGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ub3duZXJzIHx8IGN1cnJlbnRTZXR0aW5ncy5hbHdheXNTaG93T3duZXJzKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChuZWVkc1Byb2Nlc3NpbmcpIHtcclxuICAgICAgICAgICAgICAgIGxvZyhgT2JzZXJ2ZXI6IFJlcHJvY2Vzc2luZyBjYXJkcyBmb3IgJHtjb250ZXh0fSBhcyBsYWJlbHMgYXJlIGFjdGl2ZS5gKTtcclxuICAgICAgICAgICAgICAgIGNhY2hlZEVsZW1lbnRzLmRlbGV0ZShjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoY29udGV4dCwgY3VycmVudFNldHRpbmdzKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGxvZyhgT2JzZXJ2ZXI6IENhcmQgbGlzdCBjaGFuZ2VkLCBidXQgbm8gbGFiZWxzIGFyZSBhY3RpdmUgZm9yIGNvbnRleHQgJHtjb250ZXh0fS4gTm8gcmVwcm9jZXNzaW5nIG5lZWRlZC5gKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9sZExhYmVscyA9IHRhcmdldE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLndpc2hsaXN0LXdhcm5pbmcsIC5vd25lcnMtY291bnQnKTtcclxuICAgICAgICAgICAgICAgIG9sZExhYmVscy5mb3JFYWNoKGxhYmVsID0+IGxhYmVsLnJlbW92ZSgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sIDc1MCk7XHJcblxyXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihvYnNlcnZlckNhbGxiYWNrKTtcclxuICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0Tm9kZSwge1xyXG4gICAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcclxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBvYnNlcnZlckNyZWF0ZWRDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIG9ic2VydmVyQ3JlYXRlZENhbGxiYWNrKG9ic2VydmVyKTtcclxuICAgIH1cclxuICAgIGxvZyhgT2JzZXJ2ZXI6IFNldHVwIG9ic2VydmVyIGZvciBjb250ZXh0ICR7Y29udGV4dH0gb24gdGFyZ2V0OiAke3RhcmdldFNlbGVjdG9yfWApO1xyXG59IiwiaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGxvZywgbG9nV2FybiwgbG9nRXJyb3IgfSBmcm9tICcuL3V0aWxzLmpzJztcclxuaW1wb3J0IHsgY3NyZlRva2VuIH0gZnJvbSAnLi9hcGkuanMnOyBcclxuXHJcbmNvbnN0IE1BWF9BTlNXRVJTID0gMTU7XHJcbmxldCBhbnN3ZXJDb3VudCA9IDA7XHJcbmxldCBhbnN3ZXJlZFF1ZXN0aW9ucyA9IHt9OyBcclxuXHJcbmNvbnN0IHNlbmRRdWl6UmVxdWVzdCA9IGFzeW5jIChhY3Rpb24sIGRhdGEgPSB7fSkgPT4ge1xyXG4gICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB0aHJvdyBuZXcgRXJyb3IoXCJFeHRlbnNpb24gY29udGV4dCBsb3N0XCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uLCAuLi5kYXRhLCBjc3JmVG9rZW4gfSk7XHJcbiAgICAgICAgaWYgKCFyZXNwb25zZSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIHJlc3BvbnNlIHJlY2VpdmVkIGZyb20gYmFja2dyb3VuZCBmb3IgYWN0aW9uOiAke2FjdGlvbn1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQmFja2dyb3VuZCBhY3Rpb24gJHthY3Rpb259IGZhaWxlZDogJHtyZXNwb25zZS5lcnJvciB8fCAnVW5rbm93biBlcnJvcid9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhOyBcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgbG9nRXJyb3IoYEVycm9yIHNlbmRpbmcgbWVzc2FnZSBmb3IgYWN0aW9uICR7YWN0aW9ufTpgLCBlcnJvcik7XHJcbiAgICAgICAgdGhyb3cgZXJyb3I7IFxyXG4gICAgfVxyXG59O1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc1F1ZXN0aW9uKHF1ZXN0aW9uKSB7XHJcbiAgICBpZiAoIXF1ZXN0aW9uIHx8ICFxdWVzdGlvbi5pZCkge1xyXG4gICAgICAgIGxvZ0Vycm9yKFwiUmVjZWl2ZWQgaW52YWxpZCBxdWVzdGlvbiBkYXRhOlwiLCBxdWVzdGlvbik7XHJcbiAgICAgICAgbG9nKFwi8J+PgSBRdWl6IGZpbmlzaGVkIGR1ZSB0byBpbnZhbGlkIHF1ZXN0aW9uIGRhdGEuXCIpO1xyXG4gICAgICAgIGxvZyhcIkZpbmFsIGxvZzpcIiwgYW5zd2VyZWRRdWVzdGlvbnMpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYW5zd2VyQ291bnQgPj0gTUFYX0FOU1dFUlMpIHtcclxuICAgICAgICBsb2coXCLwn4+BIFJlYWNoZWQgTUFYX0FOU1dFUlMgbGltaXQuIEZpbmFsIGxvZzpcIik7XHJcbiAgICAgICAgY29uc29sZS5sb2coYW5zd2VyZWRRdWVzdGlvbnMpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBxaWQgPSBxdWVzdGlvbi5pZDtcclxuXHJcbiAgICBpZiAoYW5zd2VyZWRRdWVzdGlvbnNbcWlkXSkge1xyXG4gICAgICAgIGxvZ1dhcm4oYOKaoO+4jyBEdXBsaWNhdGUgcXVlc3Rpb24gSUQgJHtxaWR9IHNraXBwZWQuYCk7XHJcbiAgICAgICAgcmV0dXJuOyBcclxuICAgIH1cclxuXHJcbiAgICBsb2coYPCfk6EgUXVlc3Rpb24gIyR7YW5zd2VyQ291bnQgKyAxfSAoSUQ6ICR7cWlkfSk6ICR7cXVlc3Rpb24ucXVlc3Rpb259YCk7XHJcbiAgICBsb2coXCLwn5OLIE9wdGlvbnM6XCIsIHF1ZXN0aW9uLmFuc3dlcnMpO1xyXG5cclxuICAgIGFuc3dlcmVkUXVlc3Rpb25zW3FpZF0gPSB7XHJcbiAgICAgICAgcXVlc3Rpb246IHF1ZXN0aW9uLnF1ZXN0aW9uLFxyXG4gICAgICAgIGFuc3dlcnM6IHF1ZXN0aW9uLmFuc3dlcnMsXHJcbiAgICAgICAgY29ycmVjdF90ZXh0OiBxdWVzdGlvbi5jb3JyZWN0X3RleHRcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgYW5zd2VyID0gcXVlc3Rpb24uY29ycmVjdF90ZXh0O1xyXG4gICAgaWYgKGFuc3dlciA9PT0gdW5kZWZpbmVkIHx8IGFuc3dlciA9PT0gbnVsbCkge1xyXG4gICAgICAgICBsb2dFcnJvcihg4p2MIENvcnJlY3QgYW5zd2VyIChjb3JyZWN0X3RleHQpIG5vdCBmb3VuZCBmb3IgcXVlc3Rpb24gSUQgJHtxaWR9LiBTdG9wcGluZyBxdWl6LmAsIHF1ZXN0aW9uKTtcclxuICAgICAgICAgbG9nKFwiRmluYWwgbG9nOlwiLCBhbnN3ZXJlZFF1ZXN0aW9ucyk7XHJcbiAgICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsb2coYPCfkqEgQ29ycmVjdCBhbnN3ZXIgaWRlbnRpZmllZDogXCIke2Fuc3dlcn1cImApO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgbG9nKGDwn5OkIFNlbmRpbmcgYW5zd2VyIGZvciBxdWVzdGlvbiBJRCAke3FpZH0uLi5gKTtcclxuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBzZW5kUXVpelJlcXVlc3QoJ3F1aXpBbnN3ZXInLCB7IGFuc3dlcjogYW5zd2VyIH0pO1xyXG4gICAgICAgIGxvZyhg4pyFIEFuc3dlciBhY2NlcHRlZDogU3RhdHVzPSR7cmVzLnN0YXR1c30sIE1zZz0ke3Jlcy5tZXNzYWdlfSwgQ29ycmVjdENvdW50PSR7cmVzLmNvcnJlY3RfY291bnR9YCk7XHJcblxyXG4gICAgICAgIGFuc3dlckNvdW50Kys7XHJcblxyXG4gICAgICAgIGlmIChyZXMucXVlc3Rpb24gJiYgYW5zd2VyQ291bnQgPCBNQVhfQU5TV0VSUykge1xyXG4gICAgICAgICAgICBsb2coYOKPse+4jyBXYWl0aW5nIGJlZm9yZSBuZXh0IHF1ZXN0aW9uLi4uYCk7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gcHJvY2Vzc1F1ZXN0aW9uKHJlcy5xdWVzdGlvbiksIDApOyBcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAoIXJlcy5xdWVzdGlvbikgbG9nKFwi8J+PgSBObyBtb3JlIHF1ZXN0aW9ucyByZWNlaXZlZCBmcm9tIHNlcnZlci5cIik7XHJcbiAgICAgICAgICAgIGlmIChhbnN3ZXJDb3VudCA+PSBNQVhfQU5TV0VSUykgbG9nKFwi8J+PgSBSZWFjaGVkIE1BWF9BTlNXRVJTIGxpbWl0LlwiKTtcclxuICAgICAgICAgICAgbG9nKFwiRmluYWwgbG9nOlwiLCBhbnN3ZXJlZFF1ZXN0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBsb2dFcnJvcihg4p2MIEVycm9yIHNlbmRpbmcgYW5zd2VyIG9yIHByb2Nlc3NpbmcgcmVzcG9uc2UgZm9yIHF1ZXN0aW9uIElEICR7cWlkfTpgLCBlcnJvcik7XHJcbiAgICAgICAgbG9nKFwi8J+PgSBRdWl6IHN0b3BwZWQgZHVlIHRvIGVycm9yLlwiKTtcclxuICAgICAgICBsb2coXCJGaW5hbCBsb2c6XCIsIGFuc3dlcmVkUXVlc3Rpb25zKTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IHN0YXJ0UXVpeiA9IGFzeW5jICgpID0+IHtcclxuICAgIGxvZygn8J+agCBTdGFydGluZyBRdWl6Li4uJyk7XHJcbiAgICBhbnN3ZXJDb3VudCA9IDA7XHJcbiAgICBhbnN3ZXJlZFF1ZXN0aW9ucyA9IHt9O1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBzZW5kUXVpelJlcXVlc3QoJ3F1aXpTdGFydCcpO1xyXG4gICAgICAgIGlmIChyZXMgJiYgcmVzLnF1ZXN0aW9uKSB7XHJcbiAgICAgICAgICAgIGxvZyhcIvCfjokgUXVpeiBzdGFydGVkIHN1Y2Nlc3NmdWxseSEgUHJvY2Vzc2luZyBmaXJzdCBxdWVzdGlvbi5cIik7XHJcbiAgICAgICAgICAgIHByb2Nlc3NRdWVzdGlvbihyZXMucXVlc3Rpb24pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxvZ0Vycm9yKFwi4p2MIEZhaWxlZCB0byBzdGFydCBxdWl6IG9yIHJlY2VpdmUgdGhlIGZpcnN0IHF1ZXN0aW9uLlwiLCByZXMpO1xyXG4gICAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgbG9nRXJyb3IoXCLinYwgRmFpbGVkIHRvIGluaXRpYXRlIHF1aXogc3RhcnQ6XCIsIGVycm9yKTtcclxuICAgIH1cclxuICAgIGxvZyhcIuKchSBRdWl6IGluaXRpYXRpb24gYXR0ZW1wdCBmaW5pc2hlZCFcIik7XHJcbn07IiwiaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGxvZywgbG9nRXJyb3IgfSBmcm9tICcuL3V0aWxzLmpzJztcclxuXHJcbmNvbnN0IGRlZmF1bHRTZXR0aW5ncyA9IHtcclxuICBleHRlbnNpb25FbmFibGVkOiB0cnVlLFxyXG4gIHdpc2hsaXN0V2FybmluZzogMTAsXHJcbiAgd2lzaGxpc3RTdHlsZTogJ3N0eWxlLTEnLFxyXG4gIGFsd2F5c1Nob3dXaXNobGlzdDogZmFsc2UsXHJcbiAgYWx3YXlzU2hvd093bmVyczogZmFsc2UsXHJcbiAgbWluZUhpdENvdW50OiAxMDBcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBnZXRTZXR0aW5ncyA9IGFzeW5jICgpID0+IHtcclxuICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoeyAuLi5kZWZhdWx0U2V0dGluZ3MgfSk7XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0KE9iamVjdC5rZXlzKGRlZmF1bHRTZXR0aW5ncykpO1xyXG4gICAgY29uc3QgbWVyZ2VkU2V0dGluZ3MgPSB7IC4uLmRlZmF1bHRTZXR0aW5ncywgLi4uc2V0dGluZ3MgfTtcclxuICAgIHJldHVybiBtZXJnZWRTZXR0aW5ncztcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHNldHRpbmdzIGZyb20gc3RvcmFnZTonLCBlcnJvcik7XHJcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0U2V0dGluZ3MgfTtcclxuICB9XHJcbn07IiwiaW1wb3J0IHsgTE9HX1BSRUZJWCB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBjYWNoZWRFbGVtZW50cyA9IG5ldyBNYXAoKTtcclxuXHJcbmV4cG9ydCBjb25zdCBsb2cgPSAobWVzc2FnZSwgLi4uYXJncykgPT4gY29uc29sZS5sb2coYCR7TE9HX1BSRUZJWH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xyXG5leHBvcnQgY29uc3QgbG9nV2FybiA9IChtZXNzYWdlLCAuLi5hcmdzKSA9PiBjb25zb2xlLndhcm4oYCR7TE9HX1BSRUZJWH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xyXG5leHBvcnQgY29uc3QgbG9nRXJyb3IgPSAobWVzc2FnZSwgLi4uYXJncykgPT4gY29uc29sZS5lcnJvcihgJHtMT0dfUFJFRklYfSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XHJcblxyXG5leHBvcnQgY29uc3QgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQgPSAoKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiAhIWNocm9tZS5ydW50aW1lLmlkO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIGxvZ0Vycm9yKGBFeHRlbnNpb24gY29udGV4dCBpbnZhbGlkYXRlZDpgLCBlKTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgZ2V0RWxlbWVudHMgPSAoc2VsZWN0b3IpID0+IHtcclxuICAgIGNvbnN0IGR5bmFtaWNTZWxlY3RvcnMgPSBbXHJcbiAgICAgICAgJy50cmFkZV9faW52ZW50b3J5LWl0ZW0nLFxyXG4gICAgICAgICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgICAgICAgJy50cmFkZV9fbWFpbi1pdGVtJyxcclxuICAgICAgICAnLmxvb3Rib3hfX2NhcmQnLCBcclxuICAgICAgICAnLmRlY2tfX2l0ZW0nXHJcbiAgICBdO1xyXG4gICAgaWYgKCFjYWNoZWRFbGVtZW50cy5oYXMoc2VsZWN0b3IpIHx8IGR5bmFtaWNTZWxlY3RvcnMuaW5jbHVkZXMoc2VsZWN0b3IpKSB7XHJcbiAgICAgICAgY29uc3QgZWxlbWVudHMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpKTtcclxuICAgICAgICBjYWNoZWRFbGVtZW50cy5zZXQoc2VsZWN0b3IsIGVsZW1lbnRzKTtcclxuICAgIH1cclxuICAgIHJldHVybiBjYWNoZWRFbGVtZW50cy5nZXQoc2VsZWN0b3IpIHx8IFtdOyBcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBkZWJvdW5jZSA9IChmdW5jLCB3YWl0KSA9PiB7XHJcbiAgbGV0IHRpbWVvdXQ7XHJcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XHJcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpLCB3YWl0KTtcclxuICB9O1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHdhaXRGb3JFbGVtZW50cyA9IChzZWxlY3RvciwgdGltZW91dCwgc2luZ2xlID0gZmFsc2UpID0+IHtcclxuICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XHJcbiAgICBsZXQgaW50ZXJ2YWxJZDtcclxuICAgIGNvbnN0IHRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbElkKTtcclxuICAgICAgbG9nV2FybihgVGltZW91dCB3YWl0aW5nIGZvciAke3NlbGVjdG9yfWApO1xyXG4gICAgICByZXNvbHZlKHNpbmdsZSA/IG51bGwgOiBbXSk7XHJcbiAgICB9LCB0aW1lb3V0KTtcclxuXHJcbiAgICBpbnRlcnZhbElkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICBjb25zdCBlbGVtZW50cyA9IHNpbmdsZSA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpIDogQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKSk7XHJcbiAgICAgIGlmICgoc2luZ2xlICYmIGVsZW1lbnRzKSB8fCAoIXNpbmdsZSAmJiBlbGVtZW50cy5sZW5ndGggPiAwKSkge1xyXG4gICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxJZCk7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVySWQpO1xyXG4gICAgICAgIGxvZyhgRm91bmQgJHtzaW5nbGUgPyAnZWxlbWVudCcgOiBlbGVtZW50cy5sZW5ndGggKyAnIGVsZW1lbnRzJ30gZm9yICR7c2VsZWN0b3J9YCk7XHJcbiAgICAgICAgcmVzb2x2ZShlbGVtZW50cyk7XHJcbiAgICAgIH1cclxuICAgIH0sIDEwMCk7XHJcbiAgfSk7XHJcbn07IiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIiLCIvLyBzdGFydHVwXG4vLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbi8vIFRoaXMgZW50cnkgbW9kdWxlIGlzIHJlZmVyZW5jZWQgYnkgb3RoZXIgbW9kdWxlcyBzbyBpdCBjYW4ndCBiZSBpbmxpbmVkXG52YXIgX193ZWJwYWNrX2V4cG9ydHNfXyA9IF9fd2VicGFja19yZXF1aXJlX18oXCIuL21haW4uanNcIik7XG4iLCIiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=