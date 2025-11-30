import { isExtensionContextValid, log, logWarn, logError } from './utils.js';
import { csrfToken } from './api.js'; 

const MAX_ANSWERS = 15;
let answerCount = 0;
let answeredQuestions = {}; 

const sendQuizRequest = async (action, data = {}) => {
    if (!isExtensionContextValid()) throw new Error("Extension context lost");
    try {
        const response = await chrome.runtime.sendMessage({ action, ...data, csrfToken });
        if (!response) {
            throw new Error(`No response received from background for action: ${action}`);
        }
        if (!response.success) {
            throw new Error(`Background action ${action} failed: ${response.error || 'Unknown error'}`);
        }
        return response.data; 
    } catch (error) {
        logError(`Error sending message for action ${action}:`, error);
        throw error; 
    }
};

async function processQuestion(question) {
    if (!question || !question.id) {
        logError("Received invalid question data:", question);
        log("🏁 Quiz finished due to invalid question data.");
        log("Final log:", answeredQuestions);
        return;
    }

    if (answerCount >= MAX_ANSWERS) {
        log("🏁 Reached MAX_ANSWERS limit. Final log:");
        console.log(answeredQuestions);
        return;
    }

    const qid = question.id;

    if (answeredQuestions[qid]) {
        logWarn(`⚠️ Duplicate question ID ${qid} skipped.`);
        return; 
    }

    log(`📡 Question #${answerCount + 1} (ID: ${qid}): ${question.question}`);
    log("📋 Options:", question.answers);

    answeredQuestions[qid] = {
        question: question.question,
        answers: question.answers,
        correct_text: question.correct_text
    };

    const answer = question.correct_text;
    if (answer === undefined || answer === null) {
         logError(`❌ Correct answer (correct_text) not found for question ID ${qid}. Stopping quiz.`, question);
         log("Final log:", answeredQuestions);
         return;
    }

    log(`💡 Correct answer identified: "${answer}"`);

    try {
        log(`📤 Sending answer for question ID ${qid}...`);
        const res = await sendQuizRequest('quizAnswer', { answer: answer });
        log(`✅ Answer accepted: Status=${res.status}, Msg=${res.message}, CorrectCount=${res.correct_count}`);

        answerCount++;

        if (res.question && answerCount < MAX_ANSWERS) {
            log(`⏱️ Waiting before next question...`);
            setTimeout(() => processQuestion(res.question), 0); 
        } else {
            if (!res.question) log("🏁 No more questions received from server.");
            if (answerCount >= MAX_ANSWERS) log("🏁 Reached MAX_ANSWERS limit.");
            log("Final log:", answeredQuestions);
        }
    } catch (error) {
        logError(`❌ Error sending answer or processing response for question ID ${qid}:`, error);
        log("🏁 Quiz stopped due to error.");
        log("Final log:", answeredQuestions);
    }
}

export const startQuiz = async () => {
    log('🚀 Starting Quiz...');
    answerCount = 0;
    answeredQuestions = {};
    try {
        const res = await sendQuizRequest('quizStart');
        if (res && res.question) {
            log("🎉 Quiz started successfully! Processing first question.");
            processQuestion(res.question);
        } else {
            logError("❌ Failed to start quiz or receive the first question.", res);
        }
    } catch (error) {
        logError("❌ Failed to initiate quiz start:", error);
    }
    log("✅ Quiz initiation attempt finished!");
};