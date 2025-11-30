import logging
import time
import random
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
from datetime import datetime

logging.basicConfig(
    level=logging.INFO, 
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)

BASE_URL = "https://mangabuff.ru"
EMAIL = "hskwbd69@gmail.com"
PASSWORD = "hskwbd69@gmail.com"

# Результаты тестов
test_results = {
    "start_time": None,
    "tests": [],
    "analysis": {}
}

def selenium_login():
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--lang=ru")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    wait = WebDriverWait(driver, 15)
    logging.info("Авторизация на сайте...")
    driver.get(BASE_URL)
    time.sleep(random.uniform(2, 3))
    
    login_link = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a.header-login")))
    login_link.click()
    time.sleep(random.uniform(1, 2))
    
    email_input = wait.until(EC.presence_of_element_located((By.NAME, "email")))
    password_input = wait.until(EC.presence_of_element_located((By.NAME, "password")))
    
    email_input.send_keys(EMAIL)
    time.sleep(random.uniform(0.5, 1))
    password_input.send_keys(PASSWORD)
    time.sleep(random.uniform(0.5, 1))
    
    login_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button.login-button")))
    login_button.click()
    
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.header-profile.dropdown__trigger")))
    time.sleep(random.uniform(2, 3))
    
    logging.info("✅ Авторизация успешна")
    return driver

def create_session():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
    })
    
    retry_strategy = Retry(total=0, status_forcelist=[])
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    
    return session

def transfer_cookies(driver, session):
    for cookie in driver.get_cookies():
        session.cookies.set(cookie["name"], cookie["value"])
    logging.info("✅ Cookies переданы в session")

def make_request(session, url, delay=0):
    """Делает запрос и возвращает (status_code, response_time)"""
    if delay > 0:
        time.sleep(delay)
    
    start = time.time()
    try:
        resp = session.get(url, timeout=10)
        elapsed = time.time() - start
        return resp.status_code, elapsed
    except Exception as e:
        elapsed = time.time() - start
        logging.error(f"Ошибка запроса: {e}")
        return None, elapsed

def get_test_urls(session, count=20):
    """Получает список тестовых URL карточек"""
    logging.info(f"Получаем {count} тестовых URL...")
    
    # Берем карточки из каталога
    catalog_url = f"{BASE_URL}/cards"
    resp = session.get(catalog_url)
    
    if resp.status_code != 200:
        logging.error(f"Не удалось получить каталог: {resp.status_code}")
        return []
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    cards = []
    
    for wrapper in soup.find_all('div', class_='manga-cards__item-wrapper')[:count]:
        item = wrapper.find('div', class_='manga-cards__item')
        if item:
            card_id = item.get('data-card-id', '').strip()
            if card_id:
                # URL для подсчета wants (это то, что мы парсим)
                url = f"{BASE_URL}/cards/{card_id}/offers/want"
                cards.append(url)
    
    logging.info(f"✅ Получено {len(cards)} тестовых URL")
    return cards

# ==================== ТЕСТЫ ====================

def test_burst_requests(session, urls, requests_count=200, delay=0.5):
    """
    Тест 1: Быстрая серия запросов
    Цель: найти точный лимит запросов до первой 429
    """
    logging.info(f"\n{'='*60}")
    logging.info(f"ТЕСТ 1: Серия из {requests_count} запросов с задержкой {delay}с")
    logging.info(f"{'='*60}")
    
    test_data = {
        "name": "burst_requests",
        "params": {"requests_count": requests_count, "delay": delay},
        "start_time": time.time(),
        "requests": [],
        "first_429_at": None
    }
    
    request_times = []
    
    for i in range(requests_count):
        url = urls[i % len(urls)]
        status, elapsed = make_request(session, url, delay)
        
        current_time = time.time()
        request_times.append(current_time)
        
        test_data["requests"].append({
            "num": i + 1,
            "status": status,
            "time": current_time,
            "elapsed": elapsed
        })
        
        # Считаем запросы в разных окнах
        requests_last_30s = sum(1 for t in request_times if current_time - t < 30)
        requests_last_60s = sum(1 for t in request_times if current_time - t < 60)
        requests_last_120s = sum(1 for t in request_times if current_time - t < 120)
        
        if status == 429:
            logging.warning(
                f"🚨 429 на запросе #{i+1}\n"
                f"   Запросов за 30 сек: {requests_last_30s}\n"
                f"   Запросов за 60 сек: {requests_last_60s}\n"
                f"   Запросов за 120 сек: {requests_last_120s}\n"
                f"   Время с начала: {current_time - test_data['start_time']:.1f}с"
            )
            test_data["first_429_at"] = i + 1
            test_data["requests_in_30s"] = requests_last_30s
            test_data["requests_in_60s"] = requests_last_60s
            test_data["requests_in_120s"] = requests_last_120s
            break
        
        if (i + 1) % 10 == 0:
            logging.info(f"Выполнено {i+1}/{requests_count} запросов (последние 60с: {requests_last_60s})")
    
    test_data["end_time"] = time.time()
    test_data["duration"] = test_data["end_time"] - test_data["start_time"]
    
    if test_data["first_429_at"]:
        logging.info(f"✅ Тест завершен: 429 получена на запросе #{test_data['first_429_at']}")
    else:
        logging.info(f"✅ Тест завершен: 429 не получена за {requests_count} запросов")
    
    return test_data

def test_sliding_window(session, urls, window_size=60, target_requests=150):
    """
    Тест 2: Проверка скользящего окна
    Цель: определить, есть ли временное окно (sliding window)
    """
    logging.info(f"\n{'='*60}")
    logging.info(f"ТЕСТ 2: Проверка скользящего окна ({window_size}с)")
    logging.info(f"Делаем {target_requests} запросов быстро, потом ждем и повторяем")
    logging.info(f"{'='*60}")
    
    test_data = {
        "name": "sliding_window",
        "params": {"window_size": window_size, "target_requests": target_requests},
        "phases": []
    }
    
    # Фаза 1: быстрые запросы
    logging.info("Фаза 1: Быстрая серия запросов")
    phase1_start = time.time()
    got_429_phase1 = False
    
    for i in range(target_requests):
        url = urls[i % len(urls)]
        status, _ = make_request(session, url, 0.3)
        
        if status == 429:
            logging.warning(f"🚨 429 в фазе 1 на запросе #{i+1}")
            got_429_phase1 = True
            break
        
        if (i + 1) % 20 == 0:
            logging.info(f"Фаза 1: {i+1}/{target_requests}")
    
    phase1_duration = time.time() - phase1_start
    
    test_data["phases"].append({
        "phase": 1,
        "got_429": got_429_phase1,
        "duration": phase1_duration
    })
    
    if got_429_phase1:
        logging.info("⏸️  Получили 429 в фазе 1, ждем окно...")
        time.sleep(window_size + 10)
    else:
        logging.info(f"✅ Фаза 1: {target_requests} запросов за {phase1_duration:.1f}с без 429")
        logging.info(f"⏸️  Ждем {window_size}с для сброса окна...")
        time.sleep(window_size + 5)
    
    # Фаза 2: повторяем после паузы
    logging.info("Фаза 2: Повторная серия после паузы")
    phase2_start = time.time()
    got_429_phase2 = False
    
    for i in range(target_requests):
        url = urls[i % len(urls)]
        status, _ = make_request(session, url, 0.3)
        
        if status == 429:
            logging.warning(f"🚨 429 в фазе 2 на запросе #{i+1}")
            got_429_phase2 = True
            break
        
        if (i + 1) % 20 == 0:
            logging.info(f"Фаза 2: {i+1}/{target_requests}")
    
    phase2_duration = time.time() - phase2_start
    
    test_data["phases"].append({
        "phase": 2,
        "got_429": got_429_phase2,
        "duration": phase2_duration
    })
    
    if not got_429_phase2:
        logging.info(f"✅ Фаза 2: {target_requests} запросов за {phase2_duration:.1f}с без 429")
        logging.info("💡 ВЫВОД: Скорее всего есть скользящее окно - лимит сбрасывается")
    else:
        logging.info("💡 ВЫВОД: Возможно накопительный лимит или IP-блокировка")
    
    return test_data

def test_different_speeds(session, urls):
    """
    Тест 3: Разные скорости запросов
    Цель: понять, зависит ли лимит от скорости
    """
    logging.info(f"\n{'='*60}")
    logging.info(f"ТЕСТ 3: Тестируем разные скорости")
    logging.info(f"{'='*60}")
    
    test_data = {
        "name": "different_speeds",
        "speeds": []
    }
    
    delays = [0.5, 1.0, 2.0, 3.0]
    
    for delay in delays:
        logging.info(f"\nТестируем с задержкой {delay}с...")
        speed_start = time.time()
        got_429 = False
        requests_made = 0
        max_requests = 100
        
        for i in range(max_requests):
            url = urls[i % len(urls)]
            status, _ = make_request(session, url, delay)
            requests_made += 1
            
            if status == 429:
                logging.warning(f"🚨 429 на запросе #{i+1} (задержка {delay}с)")
                got_429 = True
                break
        
        duration = time.time() - speed_start
        
        test_data["speeds"].append({
            "delay": delay,
            "requests_made": requests_made,
            "got_429": got_429,
            "duration": duration,
            "requests_per_minute": (requests_made / duration) * 60 if duration > 0 else 0
        })
        
        if got_429:
            logging.info(f"Задержка {delay}с: 429 после {requests_made} запросов")
            logging.info("⏸️  Ждем 2 минуты перед следующим тестом...")
            time.sleep(120)
        else:
            logging.info(f"✅ Задержка {delay}с: {requests_made} запросов без 429")
            time.sleep(30)
    
    return test_data

def analyze_results(results):
    """Анализирует результаты тестов и делает выводы"""
    logging.info(f"\n{'='*60}")
    logging.info(f"АНАЛИЗ РЕЗУЛЬТАТОВ")
    logging.info(f"{'='*60}\n")
    
    analysis = {}
    
    # Анализ теста 1
    test1 = next((t for t in results["tests"] if t["name"] == "burst_requests"), None)
    if test1 and test1.get("first_429_at"):
        logging.info(f"📊 ТЕСТ 1 - Быстрая серия:")
        logging.info(f"   Первая 429 на запросе: #{test1['first_429_at']}")
        logging.info(f"   Запросов за 30 сек до 429: {test1.get('requests_in_30s', 'N/A')}")
        logging.info(f"   Запросов за 60 сек до 429: {test1.get('requests_in_60s', 'N/A')}")
        logging.info(f"   Запросов за 120 сек до 429: {test1.get('requests_in_120s', 'N/A')}")
        
        analysis["estimated_limit"] = test1.get('requests_in_60s', test1['first_429_at'])
        analysis["limit_window"] = "60 секунд (вероятно)"
    
    # Анализ теста 2
    test2 = next((t for t in results["tests"] if t["name"] == "sliding_window"), None)
    if test2:
        logging.info(f"\n📊 ТЕСТ 2 - Скользящее окно:")
        phase1 = test2["phases"][0] if len(test2["phases"]) > 0 else None
        phase2 = test2["phases"][1] if len(test2["phases"]) > 1 else None
        
        if phase1:
            logging.info(f"   Фаза 1: {'429 получена' if phase1['got_429'] else 'без 429'}")
        if phase2:
            logging.info(f"   Фаза 2 (после паузы): {'429 получена' if phase2['got_429'] else 'без 429'}")
        
        if phase1 and phase2 and not phase2['got_429']:
            analysis["sliding_window"] = True
            logging.info(f"   💡 Подтверждено: есть скользящее окно")
        else:
            analysis["sliding_window"] = False
    
    # Анализ теста 3
    test3 = next((t for t in results["tests"] if t["name"] == "different_speeds"), None)
    if test3:
        logging.info(f"\n📊 ТЕСТ 3 - Разные скорости:")
        for speed in test3["speeds"]:
            status = "❌ 429" if speed["got_429"] else "✅ OK"
            logging.info(
                f"   Задержка {speed['delay']}с: {status} "
                f"({speed['requests_made']} запросов, "
                f"{speed['requests_per_minute']:.1f} req/min)"
            )
    
    # Финальные выводы
    logging.info(f"\n{'='*60}")
    logging.info(f"РЕКОМЕНДАЦИИ")
    logging.info(f"{'='*60}\n")
    
    if "estimated_limit" in analysis:
        limit = analysis["estimated_limit"]
        logging.info(f"🎯 Предполагаемый лимит: ~{limit} запросов за 60 секунд")
        
        safe_limit = int(limit * 0.8)  # 80% от лимита для безопасности
        logging.info(f"🛡️  Безопасный лимит: {safe_limit} запросов/60сек")
        
        # Рекомендуемые настройки
        cards_per_60s = safe_limit // 2  # 2 запроса на карточку
        logging.info(f"📦 Карточек за 60 секунд: {cards_per_60s}")
        
        optimal_delay = 60 / safe_limit
        logging.info(f"⏱️  Оптимальная задержка: {optimal_delay:.2f} сек между запросами")
        
        # Настройки для скрипта
        logging.info(f"\n💻 Рекомендуемые настройки для main.py:")
        logging.info(f"   MIN_DELAY = {optimal_delay:.2f}")
        logging.info(f"   MAX_DELAY = {optimal_delay * 1.5:.2f}")
        logging.info(f"   MAX_WORKERS = 2  # при большем будет превышение")
        logging.info(f"   BATCH_SIZE = 20")
        logging.info(f"   BATCH_PAUSE = 10-15 сек")
        
        analysis["recommendations"] = {
            "min_delay": round(optimal_delay, 2),
            "max_delay": round(optimal_delay * 1.5, 2),
            "max_workers": 2,
            "batch_size": 20,
            "safe_requests_per_minute": safe_limit
        }
    
    return analysis

def save_results(results, filename="rate_limit_analysis.json"):
    """Сохраняет результаты в JSON"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    logging.info(f"\n💾 Результаты сохранены в {filename}")

# ==================== ГЛАВНАЯ ФУНКЦИЯ ====================

def main():
    print("""
╔══════════════════════════════════════════════════════════╗
║          АНАЛИЗАТОР RATE LIMIT (429 ERROR)               ║
║              для mangabuff.ru                            ║
╚══════════════════════════════════════════════════════════╝

Этот скрипт проведет серию тестов для определения:
  • Точного лимита запросов
  • Временного окна (sliding window)
  • Оптимальной скорости запросов

⚠️  ВНИМАНИЕ: Скрипт СПЕЦИАЛЬНО будет получать 429 ошибки!
Это нормально и необходимо для анализа.

Выберите режим тестирования:
  1. Быстрый тест (~5 минут, базовый анализ)
  2. Полный тест (~15 минут, детальный анализ)
  3. Только тест скользящего окна (~5 минут)
    """)
    
    choice = input("Ваш выбор (1/2/3): ").strip()
    
    if choice not in ["1", "2", "3"]:
        print("Неверный выбор. Выход.")
        return
    
    test_results["start_time"] = time.time()
    
    # Авторизация
    driver = None
    try:
        driver = selenium_login()
        session = create_session()
        transfer_cookies(driver, session)
    except Exception as e:
        logging.error(f"Ошибка авторизации: {e}")
        return
    finally:
        if driver:
            driver.quit()
    
    # Получаем тестовые URL
    test_urls = get_test_urls(session, count=30)
    if not test_urls:
        logging.error("Не удалось получить тестовые URL")
        return
    
    # Запускаем тесты
    if choice == "1":
        # Быстрый тест
        result1 = test_burst_requests(session, test_urls, requests_count=200, delay=0.5)
        test_results["tests"].append(result1)
        
    elif choice == "2":
        # Полный тест
        result1 = test_burst_requests(session, test_urls, requests_count=200, delay=0.5)
        test_results["tests"].append(result1)
        
        logging.info("\n⏸️  Пауза 2 минуты перед следующим тестом...")
        time.sleep(120)
        
        result2 = test_sliding_window(session, test_urls, window_size=60, target_requests=150)
        test_results["tests"].append(result2)
        
        logging.info("\n⏸️  Пауза 2 минуты перед последним тестом...")
        time.sleep(120)
        
        result3 = test_different_speeds(session, test_urls)
        test_results["tests"].append(result3)
        
    elif choice == "3":
        # Только скользящее окно
        result2 = test_sliding_window(session, test_urls, window_size=60, target_requests=150)
        test_results["tests"].append(result2)
    
    # Анализ результатов
    test_results["analysis"] = analyze_results(test_results)
    test_results["end_time"] = time.time()
    test_results["total_duration"] = test_results["end_time"] - test_results["start_time"]
    
    # Сохранение
    save_results(test_results)
    
    logging.info(f"\n✅ Все тесты завершены за {test_results['total_duration']/60:.1f} минут")
    logging.info(f"📊 Проверьте файл rate_limit_analysis.json для деталей")

if __name__ == "__main__":
    main()