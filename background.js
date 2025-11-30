const BASE_URL = 'https://mangabuff.ru';
const log = (message, ...args) => console.log(`[Background] ${message}`, ...args);
const logError = (message, ...args) => console.error(`[Background] ${message}`, ...args);

const fetchWithTimeout = async (url, options, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    log(`Выполняем запрос: ${url}`, options);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
        logError(`Таймаут запроса ${url} (${timeout}ms)`);
    } else {
        logError(`Ошибка при выполнении запроса ${url}:`, error);
    }
    clearTimeout(id);
    throw error;
  }
};

const handleQuizRequest = async (action, csrfToken, answer = null) => {
    let url, method, body;
    const headers = {
        'X-CSRF-Token': csrfToken,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    switch (action) {
        case 'quizStart':
            url = `${BASE_URL}/quiz/start`;
            method = 'POST';
            body = null;
            log('Запрос на старт квиза...');
            break;
        case 'quizAnswer':
            url = `${BASE_URL}/quiz/answer`;
            method = 'POST';
            const requestPayload = { answer: answer };
            body = JSON.stringify(requestPayload);
            headers['Content-Type'] = 'application/json';
            log(`Запрос на ответ: ${answer}`);
            break;
        default:
            logError(`Неизвестное действие для handleQuizRequest: ${action}`);
            return { success: false, error: `Unknown quiz action: ${action}` };
    }

    try {
        const response = await fetchWithTimeout(url, {
            method: method,
            headers: headers,
            body: body
        });

        let responseData = null;
        try {
             responseData = await response.json();
        } catch (jsonError) {
             if (!response.ok) {
                 try {
                     const textError = await response.text();
                     logWarn(`Non-JSON error response (${response.status}) from ${url}: ${textError}`);
                     return { success: false, error: textError || `HTTP error! status: ${response.status}`, status: response.status };
                 } catch (textReadError) {
                      logError(`Failed to read text from error response (${response.status}) from ${url}`, textReadError);
                 }
             } else {
                  log(`Received non-JSON success response (${response.status}) from ${url}`);
                  return { success: true, data: null };
             }
        }

        if (!response.ok) {
            logError(`Ошибка от API квиза (${action}) ${url}: ${response.status}`, responseData);
             const errorMessage = responseData?.error || responseData?.message || `HTTP error! status: ${response.status}`;
             return { success: false, error: errorMessage, status: response.status };
        }

        log(`Успешный ответ от API квиза (${action}):`, responseData);
        return { success: true, data: responseData };

    } catch (error) {
        logError(`Критическая ошибка при запросе к API квиза (${action}) ${url}:`, error);
        return { success: false, error: error.message || 'Network or timeout error during quiz request' };
    }
};

const fetchPage = async (url, page, csrfToken) => {
    const fullUrl = `${BASE_URL}/cards/${url}${page > 1 ? `?page=${page}` : ''}`;
    try {
      const response = await fetchWithTimeout(fullUrl, {
        method: 'GET',
        headers: { 'X-CSRF-Token': csrfToken }
      });
      if (!response.ok) {
        if (response.status === 404) {
          log(`Страница ${fullUrl} не найдена (404), считаем, что данных нет`);
          return "";
        }
        let errorText = `HTTP error! status: ${response.status}`;
        try { const errorData = await response.text(); errorText += `, details: ${errorData}`; } catch (e) { /* ignore */ }
        throw new Error(errorText);
      }
      return await response.text();
    } catch (error) {
      logError(`Ошибка при запросе ${fullUrl}:`, error);
      return "";
    }
  };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Получено сообщение:', message, 'от:', sender);

    if (message.action === 'fetchWishlistCount') {
        log(`Запрашиваем список желающих для карты ${message.cardId}, страница ${message.page}`);
        fetchPage(`${message.cardId}/offers/want`, message.page, message.csrfToken).then(text => {
          sendResponse({ success: true, text });
        }).catch(error => {
          logError(`Критическая ошибка при fetchWishlistCount для ${message.cardId}:`, error);
          sendResponse({ success: false, error: error.message, text: "" });
        });
        return true;
      }

      if (message.action === 'fetchOwnersCount') {
        log(`Запрашиваем список владельцев для карты ${message.cardId}, страница ${message.page}`);
        fetchPage(`${message.cardId}/users`, message.page, message.csrfToken).then(text => {
          sendResponse({ success: true, text });
        }).catch(error => {
          logError(`Критическая ошибка при fetchOwnersCount для ${message.cardId}:`, error);
          sendResponse({ success: false, error: error.message, text: "" });
        });
        return true;
      }

      if (message.action === 'clearWishlistCache') {
        log('Обрабатываем clearWishlistCache');
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            logError('Ошибка при очистке кэша:', chrome.runtime.lastError);
            sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
          } else {
            log('Кэш успешно очищен');
            chrome.tabs.query({ url: 'https://mangabuff.ru/*' }, tabs => {
              if (chrome.runtime.lastError) {
                   logError('Ошибка при запросе вкладок:', chrome.runtime.lastError);
                   sendResponse({ status: 'success', warning: 'Cache cleared, but failed to query tabs.' });
                   return;
              }
              if (tabs.length === 0) {
                log('Вкладки mangabuff.ru не найдены');
                sendResponse({ status: 'success' });
                return;
              }
              let responsesPending = tabs.length;
              const tabsLength = tabs.length;
              tabs.forEach(tab => {
                log(`Отправляем clearWishlistCache на вкладку ${tab.id}`);
                try {
                    chrome.tabs.sendMessage(tab.id, { action: 'clearWishlistCache' }, response => {
                        responsesPending--;
                        if (chrome.runtime.lastError) {
                             logWarn(`Ошибка при отправке/получении ответа от вкладки ${tab.id}:`, chrome.runtime.lastError.message || 'No response');
                        } else {
                             log(`Ответ от вкладки ${tab.id}:`, response);
                        }
                        if (responsesPending === 0) {
                             log('Завершены все ответы от вкладок по clearWishlistCache');
                        }
                    });
                } catch (error) {
                     logError(`Не удалось отправить сообщение на вкладку ${tab.id}:`, error);
                     responsesPending--;
                     if (responsesPending === 0) {
                         log('Завершены все ответы от вкладок по clearWishlistCache (с ошибками отправки)');
                     }
                }
              });
              sendResponse({ status: 'success', info: `Sent clear request to ${tabsLength} tabs.` });
            });
          }
        });
        return true;
      }

      if (message.action === 'quizStart') {
          if (!message.csrfToken) {
               logError('CSRF token is missing for quizStart');
               sendResponse({ success: false, error: 'CSRF token is missing' });
               return false;
          }
          handleQuizRequest('quizStart', message.csrfToken)
              .then(response => sendResponse(response));
          return true;
      }

      if (message.action === 'quizAnswer') {
          if (!message.csrfToken) {
               logError('CSRF token is missing for quizAnswer');
               sendResponse({ success: false, error: 'CSRF token is missing' });
               return false;
           }
           if (message.answer === undefined || message.answer === null) {
               logError('Answer is missing for quizAnswer');
               sendResponse({ success: false, error: 'Answer not provided in message' });
               return false;
           }
          handleQuizRequest('quizAnswer', message.csrfToken, message.answer)
              .then(response => sendResponse(response));
          return true;
      }

    if (message.action === 'mineHit') {
        if (!message.csrfToken) {
            logError('CSRF token is missing for mineHit');
            sendResponse({ success: false, error: 'CSRF token is missing' });
            return false;
        } //2
        if (!message.url) {
             logError('URL is missing for mineHit');
             sendResponse({ success: false, error: 'URL is missing' });
             return false;
        }

        fetchWithTimeout(message.url, {
            method: 'POST',
            headers: {
                'X-CSRF-Token': message.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/plain, */*'
            },
            body: null
        })
        .then(async response => {
            let responseData = null;
            try {
                responseData = await response.json();
            } catch (e) {
                 if (!response.ok) {
                     try {
                          const textError = await response.text();
                           sendResponse({ success: false, error: textError || `HTTP error! status: ${response.status}`, status: response.status });
                     } catch (readError) {
                          sendResponse({ success: false, error: `HTTP error! status: ${response.status}`, status: response.status });
                     }
                     return;
                 } else {
                      log(`Mine hit successful (${response.status}), but no JSON data received.`);
                      responseData = { message: 'Success (No JSON Data)'};
                 }
            }

            if (!response.ok) {
                logWarn(`Mine hit failed (${response.status}) with JSON response:`, responseData);
                const errorMsg = responseData?.error || responseData?.message || `HTTP error! status: ${response.status}`;
                sendResponse({ success: false, error: errorMsg, status: response.status, data: responseData });
            } else {
                 log(`Mine hit successful (${response.status}). Data:`, responseData);
                 sendResponse({ success: true, data: responseData });
            }
        })
        .catch(error => {
            logError(`Critical error during mineHit fetch to ${message.url}:`, error);
            sendResponse({ success: false, error: error.message || 'Network or timeout error during mine hit' });
        });

        return true;
    }

    logWarn(`Неизвестное действие получено: ${message.action}`);
    sendResponse({ status: 'unknown_action', received: message });
    return false;
});