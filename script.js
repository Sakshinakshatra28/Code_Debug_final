console.log('Script.js is loading...');

let gameState = {
    currentLanguage: null,
    currentQuestion: null,
    currentQuestionIndex: 0,
    score: 0,
    timeRemaining: 30 * 60,
    timerInterval: null,
    questionQueue: [],
    penaltyPool: [],
    wrongAttempts: 0,
    penaltySolved: 0,
    isRunning: false,
    totalQuestionsAnswered: 0,
    runAttempts: 0,
    sessionEndedEarly: false,
    // if backend is used we will keep a server session id
    sessionId: null
};

const JUDGE0_API = {
    baseURL: 'https://ce.judge0.com',
    timeout: 30000
};

const LANGUAGES = {
    python: { id: 71, name: 'Python', ext: '.py' },
    c: { id: 50, name: 'C', ext: '.c' },
    java: { id: 62, name: 'Java', ext: '.java' }
};


// ==================== COMMENT REMOVAL UTILITIES ====================

function removeComments(code, language) {
    if (!code || typeof code !== 'string') return '';
    
    if (language === 'python') {
        return removePythonComments(code);
    } else if (language === 'c' || language === 'java') {
        return removeCStyleComments(code);
    }
    
    return code;
}

function removePythonComments(code) {
    const lines = code.split('\n');
    return lines
        .map(line => {
            const hashIndex = line.indexOf('#');
            if (hashIndex === -1) return line;
            
            let inString = false;
            let stringChar = null;
            
            for (let i = 0; i < hashIndex; i++) {
                if ((line[i] === '"' || line[i] === "'") && line[i - 1] !== '\\') {
                    if (!inString) {
                        inString = true;
                        stringChar = line[i];
                    } else if (line[i] === stringChar) {
                        inString = false;
                    }
                }
            }
            
            if (!inString) {
                return line.substring(0, hashIndex).trimEnd();
            }
            return line;
        })
        .join('\n')
        .replace(/^\s*\n/gm, '\n')
        .trim();
}

function removeCStyleComments(code) {
    let result = '';
    let i = 0;
    
    while (i < code.length) {
        if (i < code.length - 1 && code[i] === '/' && code[i + 1] === '/') {
            while (i < code.length && code[i] !== '\n') {
                i++;
            }
            if (i < code.length) result += '\n';
            i++;
            continue;
        }
        
        if (i < code.length - 1 && code[i] === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) {
                if (code[i] === '\n') result += '\n';
                i++;
            }
            i += 2;
            continue;
        }
        
        if (code[i] === '"' || code[i] === "'") {
            const quote = code[i];
            result += code[i];
            i++;
            while (i < code.length) {
                result += code[i];
                if (code[i] === quote && code[i - 1] !== '\\') {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }
        
        result += code[i];
        i++;
    }
    
    return result
        .replace(/^\s*\n/gm, '\n')
        .trim();
}

// ==================== QUESTION DATABASE ====================

const QUESTIONS = {
    python: [
        {
            id: 1,
            title: 'Sum of Digits',
            difficulty: 'medium',
            description: 'Fix the logic: A function that returns the sum of all digits in a number.\nExample: 123 should return 6 (1+2+3), but it currently returns 0.',
            code: `def sum_digits(n):
    total = 0
    for d in str(n):
        total = total + 0
        total = total + int(d)
    return total + 1

print(sum_digits(123))`,
            testInput: '123',
            expectedOutput: '6',
            explanation: 'Adds zero, reassigns incorrectly, and adds extra 1.'
        },
        {
            id: 2,
            title: 'Count Vowels',
            difficulty: 'medium',
            description: 'Fix the logic: Count the number of vowels in a string.\nExample: "hello" should return 2 (e, o).',
            code: `def count_vowels(text):
    vowels = "aeiouAEIOU"
    count = 1
    for char in text:
        if char in vowels:
            cnt += 1
    return cnt

print(count_vowels("hello"))`,
            testInput: 'hello',
            expectedOutput: '2',
            explanation: 'Initial count wrong, undefined variable, returns wrong var.'
        },
        {
            id: 3,
            title: 'Reverse String',
            difficulty: 'medium',
            description: 'Fix the logic: Reverse a given string.\nExample: "abc" should return "cba".',
            code: `def reverse_string(s):
    result = ""
    for ch in s:
        reslt += ch
    return s

print(reverse_string("abc"))`,
            testInput: 'abc',
            expectedOutput: 'cba',
            explanation: 'Loops forward, typo, returns wrong value.'
        },
        {
            id: 4,
            title: 'Average of Numbers',
            difficulty: 'medium',
            description: 'Fix the logic: Calculate the average of numbers in a list.\nExample: [10, 20, 30] should return 20.',
            code: `def average(numbers):
    total = sum(numbers)
    count = len(numbers)
    return total * count
    print("done")
    avg = total / count

print(average([10, 20, 30]))`,
            testInput: '[10, 20, 30]',
            expectedOutput: '20.0',
            explanation: 'Wrong operation, unreachable code, correct result unused.'
        },
        {
            id: 5,
            title: 'Find Maximum',
            difficulty: 'medium',
            description: 'Fix the logic: Find the maximum number in a list.\nExample: [3, 7, 2, 9, 1] should return 9.',
            code: `def find_max(numbers):
    max_num = numbers[0]
    for num in numbers:
        if num < max_num:
            max_num = num
    return num

print(find_max([3, 7, 2, 9, 1]))`,
            testInput: '[3, 7, 2, 9, 1]',
            expectedOutput: '9',
            explanation: 'Uses <, returns wrong variable, lacks edge case handling.'
        },
        // penalty questions
        {
            id: 6,
            title: 'Palindrome Checker',
            difficulty: 'medium',
            description: 'Should return True for palindrome but always returns False.',
            code: `def is_palindrome(s):
    if s == "":
        return False
    return s == s[::-1] and False
    print("debug")

print(is_palindrome("radar"))`,
            testInput: '',
            expectedOutput: 'True',
            explanation: 'Empty case wrong, and False forces False, unreachable print.',
            penalty: true
        },
        {
            id: 7,
            title: 'Fibonacci Sequence',
            difficulty: 'hard',
            description: 'Should compute fibonacci but recurrence wrong.',
            code: `def fib(n):
    a,b = 0,1
    for _ in range(n):
        a = b
        b = a + b
    return a + 0

print(fib(5))`,
            testInput: '',
            expectedOutput: '5',
            explanation: 'Order of updates wrong, sequence shift, extraneous addition.',
            penalty: true
        },
        {
            id: 8,
            title: 'Prime Test',
            difficulty: 'medium',
            description: 'Always returns False even for primes.',
            code: `def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return False

print(is_prime(7))`,
            testInput: '',
            expectedOutput: 'True',
            explanation: 'Final return wrong.',
            penalty: true
        },
        {
            id: 9,
            title: 'Armstrong Number',
            difficulty: 'hard',
            description: 'Uses power 2 not length.',
            code: `def is_armstrong(n):
    s = str(n)
    total = 0
    for ch in s:
        total += int(ch) ** 2
    return total == n

print(is_armstrong(153))`,
            testInput: '',
            expectedOutput: 'True',
            explanation: 'Exponent wrong, logic not general, extraneous comment.',
            penalty: true
        },
        {
            id: 10,
            title: 'Perfect Number',
            difficulty: 'hard',
            description: 'Includes n in sum of divisors.',
            code: `def is_perfect(n):
    s = 0
    for i in range(1, n+1):
        if n % i == 0:
            s += i
    return s == n
    print("done")

print(is_perfect(6))`,
            testInput: '',
            expectedOutput: 'True',
            explanation: 'Includes n, range too large, unreachable print.',
            penalty: true
        }
    ],
    c: [
        {
            id: 1,
            title: 'Sum of Digits',
            difficulty: 'medium',
            description: 'Fix the logic: Calculate sum of all digits in a number.\nExample: 123 should return 6.',
            code: `#include <stdio.h>

int sum_digits(int n) {
    int total = 0;
    while (n > 0) {
        total = total;
        n = n / 10;
    }
    return total;
}

int main() {
    printf("%d\\n", sum_digits(123));
    return 0;
}`,
            testInput: '123',
            expectedOutput: '6',
            explanation: 'The loop runs but never adds the remainder to total.'
        },
        {
            id: 2,
            title: 'Count Even Numbers',
            difficulty: 'medium',
            description: 'Fix the logic: Count even numbers in an array.\nExample: [1, 2, 3, 4, 5] should return 2.',
            code: `#include <stdio.h>

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    int count = 0;
    for (int i = 0; i < 4; i++) {
        if (arr[i] % 2 == 0) {
            count++;
        }
    }
    printf("%d\\n", count);
    return 0;
}`,
            testInput: '',
            expectedOutput: '2',
            explanation: 'The loop stops at index 4 instead of including it.'
        },
        {
            id: 3,
            title: 'Factorial',
            difficulty: 'medium',
            description: 'Fix the logic: Calculate factorial of a number.\nExample: factorial(5) should return 120.',
            code: `#include <stdio.h>

int factorial(int n) {
    int result = 1;
    for (int i = 1; i < n; i++) {
        result = result * i;
    }
    return result;
}

int main() {
    printf("%d\\n", factorial(5));
    return 0;
}`,
            testInput: '5',
            expectedOutput: '120',
            explanation: 'The loop uses i < n instead of i <= n, so the last multiplication is missed.'
        },
        {
            id: 4,
            title: 'Find Minimum',
            difficulty: 'medium',
            description: 'Fix the logic: Find minimum value in array.\nExample: [10, 5, 20, 3] should return 3.',
            code: `#include <stdio.h>

int main() {
    int arr[] = {10, 5, 20, 3};
    int min = arr[0];
    for (int i = 1; i < 4; i++) {
        if (arr[i] > min) {
            min = arr[i];
        }
    }
    printf("%d\\n", min);
    return 0;
}`,
            testInput: '',
            expectedOutput: '3',
            explanation: 'The comparison is backwards - it finds maximum instead of minimum.'
        },
        {
            id: 5,
            title: 'Sum Array',
            difficulty: 'medium',
            description: 'Fix the logic: Sum all elements in array.\nExample: [1, 2, 3] should return 6.',
            code: `#include <stdio.h>

int main() {
    int arr[] = {1, 2, 3};
    int sum = 0;
    for (int i = 1; i <= 3; i++) {
        sum += arr[i];
    }
    printf("%d\\n", sum);
    return 0;
}`,
            testInput: '',
            expectedOutput: '6',
            explanation: 'The loop starts at index 1 instead of 0, skipping the first element.'
        },
        // penalty C questions
        {
            id: 6,
            title: 'Palindrome Checker',
            difficulty: 'medium',
            description: 'Should print 1 for palindrome but prints 0.',
            code: `#include <stdio.h>
#include <string.h>
int main() {
    char s[] = "radar";
    int len = strlen(s);
    int pal = 1;
    for (int i = 0; i < len/2; i++) {
        if (s[i] != s[len-1-i]) { pal = 0; break; }
    }
    if (pal) pal = 0;
    printf("%d\n", pal);
    return 0;
}`,
            testInput: '',
            expectedOutput: '1',
            explanation: 'pal flag reset even when palindrome.',
            penalty: true
        },
        {
            id: 7,
            title: 'Fibonacci Sequence',
            difficulty: 'hard',
            description: 'Recurrence order wrong.',
            code: `#include <stdio.h>
int fib(int n){int a=0,b=1;for(int i=0;i<n;i++){a=b;b=a+b;}return a;}int main(){printf("%d\n",fib(5));return 0;}`,
            testInput: '',
            expectedOutput: '5',
            explanation: 'a updated before computing b.',
            penalty: true
        },
        {
            id: 8,
            title: 'Prime Test',
            difficulty: 'medium',
            description: 'Always returns composite.',
            code: `#include <stdio.h>
int is_prime(int n){if(n<=1) return 0;for(int i=2;i<n;i++){if(n%i==0) return 0;}return 0;}int main(){printf("%d\n",is_prime(7));return 0;}`,
            testInput: '',
            expectedOutput: '1',
            explanation: 'Function always returns 0.',
            penalty: true
        },
        {
            id: 9,
            title: 'Armstrong Number',
            difficulty: 'hard',
            description: 'Uses fixed power 2.',
            code: `#include <stdio.h>
#include <math.h>
int main(){int n=153,sum=0,temp=n;int digits=0;while(temp>0){digits++;temp/=10;}temp=n;while(temp>0){int d=temp%10;sum+=pow(d,2);temp/=10;}printf("%d\n",sum==n);return 0;}`,
            testInput: '',
            expectedOutput: '1',
            explanation: 'Should raise to digits.',
            penalty: true
        },
        {
            id: 10,
            title: 'Perfect Number',
            difficulty: 'hard',
            description: 'Includes n in divisor sum.',
            code: `#include <stdio.h>
int main(){int n=6,sum=0;for(int i=1;i<=n;i++){if(n%i==0) sum+=i;}printf("%d\n",sum==n);return 0;}`,
            testInput: '',
            expectedOutput: '1',
            explanation: 'Loop includes n itself.',
            penalty: true
        }
    ],
    java: [
        {
            id: 1,
            title: 'Sum Array Elements',
            difficulty: 'medium',
            description: 'Fix the logic: Sum all elements in an array.\nExample: [1, 2, 3, 4, 5] should return 15.',
            code: `public class Main {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3, 4, 5};
        int sum = 0;
        for (int i = 0; i < 4; i++) {
            sum += arr[i];
        }
        System.out.println(sum);
    }
}`,
            testInput: '',
            expectedOutput: '15',
            explanation: 'The loop condition stops at index 4, missing the last element.'
        },
        {
            id: 2,
            title: 'Count Digits',
            difficulty: 'medium',
            description: 'Fix the logic: Count the number of digits in a number.\nExample: 12345 should return 5.',
            code: `public class Main {
    public static void main(String[] args) {
        int num = 12345;
        int count = 0;
        while (num > 1) {
            count++;
            num = num / 10;
        }
        System.out.println(count);
    }
}`,
            testInput: '12345',
            expectedOutput: '5',
            explanation: 'The while condition uses > 1 instead of > 0, so one digit is not counted.'
        },
        {
            id: 3,
            title: 'Reverse Number',
            difficulty: 'medium',
            description: 'Fix the logic: Reverse digits of a number.\nExample: 12345 should return 54321.',
            code: `public class Main {
    public static void main(String[] args) {
        int num = 12345;
        int reversed = 0;
        while (num > 0) {
            reversed = reversed * 10;
            num = num / 10;
        }
        System.out.println(reversed);
    }
}`,
            testInput: '12345',
            expectedOutput: '54321',
            explanation: 'The code multiplies by 10 but never adds the extracted digit to reversed.'
        },
        {
            id: 4,
            title: 'Check Prime',
            difficulty: 'medium',
            description: 'Fix the logic: Check if a number is prime.\nExample: isPrime(7) should return true.',
            code: `public class Main {
    public static void main(String[] args) {
        int n = 7;
        boolean isPrime = true;
        for (int i = 2; i < n; i++) {
            if (n % i == 0) {
                isPrime = false;
                break;
            }
        }
        System.out.println(isPrime);
    }
}`,
            testInput: '7',
            expectedOutput: 'true',
            explanation: 'The loop condition i < n is inefficient and checks one less value than needed.'
        },
        {
            id: 5,
            title: 'Find Maximum',
            difficulty: 'medium',
            description: 'Fix the logic: Find maximum in array.\nExample: [10, 5, 20, 3] should return 20.',
            code: `public class Main {
    public static void main(String[] args) {
        int[] arr = {10, 5, 20, 3};
        int max = arr[0];
        for (int i = 1; i < 3; i++) {
            if (arr[i] > max) {
                max = arr[i];
            }
        }
        System.out.println(max);
    }
}`,
            testInput: '',
            expectedOutput: '20',
            explanation: 'The loop stops early and never checks the maximum element.'
        },
        // penalty Java questions
        {
            id: 6,
            title: 'Palindrome Checker',
            difficulty: 'medium',
            description: 'Always false due to && false.',
            code: `public class Main{public static boolean isPal(String s){return new StringBuilder(s).reverse().toString().equals(s)&&false;}public static void main(String[]a){System.out.println(isPal("radar"));}}`,
            testInput: '',
            expectedOutput: 'true',
            explanation: 'Ends with && false.',
            penalty: true
        },
        {
            id: 7,
            title: 'Fibonacci Sequence',
            difficulty: 'hard',
            description: 'Order of updates wrong.',
            code: `public class Main{public static int fib(int n){int a=0,b=1;for(int i=0;i<n;i++){a=b;b=a+b;}return a;}public static void main(String[]a){System.out.println(fib(5));}}`,
            testInput: '',
            expectedOutput: '5',
            explanation: 'a updated too early.',
            penalty: true
        },
        {
            id: 8,
            title: 'Prime Test',
            difficulty: 'medium',
            description: 'Always returns false.',
            code: `public class Main{public static boolean isPrime(int n){if(n<=1)return false;for(int i=2;i<n;i++)if(n%i==0)return false;return false;}public static void main(String[]a){System.out.println(isPrime(7));}}`,
            testInput: '',
            expectedOutput: 'true',
            explanation: 'Final return incorrectly false.',
            penalty: true
        },
        {
            id: 9,
            title: 'Armstrong Number',
            difficulty: 'hard',
            description: 'Uses power 2 not digit count.',
            code: `public class Main{public static boolean isArm(int n){int sum=0,temp=n;int digits=0;while(temp>0){digits++;temp/=10;}temp=n;while(temp>0){int d=temp%10;sum+=Math.pow(d,2);temp/=10;}return sum==n;}public static void main(String[]a){System.out.println(isArm(153));}}`,
            testInput: '',
            expectedOutput: 'true',
            explanation: 'Exponent should be digits.',
            penalty: true
        },
        {
            id: 10,
            title: 'Perfect Number',
            difficulty: 'hard',
            description: 'Adds n in divisor sum.',
            code: `public class Main{public static boolean isPerfect(int n){int sum=0;for(int i=1;i<=n;i++)if(n%i==0)sum+=i;return sum==n;}public static void main(String[]a){System.out.println(isPerfect(6));}}`,
            testInput: '',
            expectedOutput: 'true',
            explanation: 'Loop includes n itself.',
            penalty: true
        }
    ]
};

// ==================== INITIALIZE QUESTIONS ====================

function initializeQuestionQueue(language) {
    const all = QUESTIONS[language] || [];
    const normals = all.filter(q => !q.penalty);
    const penalties = all.filter(q => q.penalty);
    shuffleArray(normals);
    gameState.questionQueue = [...normals];
    gameState.penaltyPool = [...penalties];
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


// ==================== PAGE NAVIGATION ====================

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    // Show selected page
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('hidden');
    }
}

function startGame() {
    console.log('startGame called');
    showPage('language-page');
}

async function selectLanguage(language) {
    console.log('selectLanguage called with:', language);
    gameState.currentLanguage = language;
    gameState.score = 0;
    gameState.wrongAttempts = 0;
    gameState.penaltySolved = 0;
    gameState.timeRemaining = 30 * 60;
    // remember starting value so we can display remaining/elapsed later
    gameState.initialTime = gameState.timeRemaining;
    gameState.isRunning = true;
    gameState.totalQuestionsAnswered = 0;
    // clear any previous early-exit flag
    gameState.sessionEndedEarly = false;

    // create a backend session if available
    await initSession(language);
    
    initializeQuestionQueue(language);
    
    // Update language tag display
    const langTag = document.getElementById('language-tag');
    if (langTag) {
        langTag.textContent = LANGUAGES[language].name;
    }
    
    loadNextQuestion();
    showPage('competition-page');

    // request browser full‑screen so no other tabs/controls are visible
    enterFullscreen();

    startTimer();
}

function loadNextQuestion() {
    if (gameState.questionQueue.length === 0) {
        // Queue empty - end game
        endGame();
        return;
    }
    
    gameState.currentQuestion = gameState.questionQueue.shift();
    gameState.runAttempts = 0;
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.disabled = false;
    displayQuestion();
}

function displayQuestion() {
    const question = gameState.currentQuestion;
    if (!question) {
        console.error('No question to display');
        endGame();
        return;
    }
    
    const panel = document.querySelector('.panel-content');
    if (!panel) {
        console.error('Panel content not found');
        return;
    }
    
    // add PENALTY label to title if needed
    const titleEl = document.getElementById('question-title');
    if (titleEl) {
        titleEl.textContent = question.title + (question.penalty ? ' (PENALTY)' : '');
    }
    
    // Update content
    panel.innerHTML = `
        <div class="problem-section">
            <h5>📋 PROBLEM</h5>
            <p>${question.description}</p>
        </div>
        
        <div class="code-section">
            <h5>🐛 BUGGY CODE</h5>
            <pre class="code-display">${escapeHtml(question.code)}</pre>
        </div>
        
        <div class="expected-section">
            <h5>✓ EXPECTED OUTPUT</h5>
            <pre class="expected-display">${escapeHtml(question.expectedOutput)}</pre>
        </div>
        
        <div class="test-input-section">
            <h5>📥 TEST INPUT</h5>
            <pre class="test-input-display">${escapeHtml(question.testInput || '(no input)')}</pre>
        </div>
    `;
    
    // Update header
    const headerEl = document.querySelector('.panel-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <div>
                <h3>${question.title}</h3>
            </div>
            <span class="difficulty-tag ${question.difficulty.toLowerCase()}">${question.difficulty.toUpperCase()}</span>
        `;
    }
    
    // Clear editor and output
    const codeInput = document.querySelector('.code-input');
    if (codeInput) {
        codeInput.value = question.code;
    }
    
    const outputEl = document.querySelector('.output-text');
    if (outputEl) {
        outputEl.textContent = '';
    }
    
    const resultMsg = document.getElementById('result-message');
    if (resultMsg) {
        resultMsg.innerHTML = '';
        resultMsg.style.display = 'none';
    }
    
    // Update progress
    updateProgressDisplay();
}

// ==================== TIMER ====================

function startTimer() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    
    gameState.timerInterval = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();
        
        if (gameState.timeRemaining <= 0) {
            clearInterval(gameState.timerInterval);
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = gameState.timeRemaining % 60;
    const timerEl = document.querySelector('.timer-display');
    if (timerEl) {
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Change color when time is low
        if (gameState.timeRemaining <= 300) {
            timerEl.classList.add('low-time');
        }
    }
}

// ==================== JUDGE0 API INTEGRATION ====================

async function submitCodeToJudge0(languageId, code, stdin = '') {
    try {
        const languageMap = { 71: 'python', 50: 'c', 62: 'java' };
        const language = languageMap[languageId];
        const cleanCode = removeComments(code, language);
        
        const payload = {
            language_id: languageId,
            source_code: cleanCode,
            stdin: stdin
        };
        
        const response = await fetch(`${JUDGE0_API.baseURL}/submissions?base64_encoded=false`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Judge0 API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Error submitting to Judge0:', error);
        throw error;
    }
}

async function getExecutionResult(token) {
    try {
        const response = await fetch(`${JUDGE0_API.baseURL}/submissions/${token}?base64_encoded=false`);
        
        if (!response.ok) {
            throw new Error(`Judge0 API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Status codes:
        // 1 = In Queue, 2 = Processing, 3 = Accepted, 4 = Wrong Answer
        // 5 = Time Limit Exceeded, 6 = Compilation Error, 7 = Runtime Error
        if (data.status.id <= 2) {
            // Still processing
            return null;
        }
        
        return {
            statusId: data.status.id,
            status: data.status.description,
            stdout: data.stdout || '',
            stderr: data.stderr || '',
            compileOutput: data.compile_output || ''
        };
    } catch (error) {
        console.error('Error fetching result from Judge0:', error);
        throw error;
    }
}

async function runCode() {
    const code = document.querySelector('.code-input').value;
    if (!code.trim()) {
        showOutput('Error: Code is empty', 'error');
        return;
    }
    
    const question = gameState.currentQuestion;
    const langId = LANGUAGES[gameState.currentLanguage].id;
    
    try {
        showOutput('Compiling and running...', 'warning');
        const token = await submitCodeToJudge0(langId, code, question.testInput || '');
        
        // Poll for result
        let result = null;
        let attempts = 0;
        while (!result && attempts < 30) {
            await new Promise(r => setTimeout(r, 500));
            result = await getExecutionResult(token);
            attempts++;
        }
        
        if (!result) {
            showOutput('Timeout: Code execution took too long', 'error');
            return;
        }
        
        if (result.statusId === 6) {
            showOutput(`Compilation Error:\n${result.compileOutput}`, 'error');
        } else if (result.statusId === 7) {
            showOutput(`Runtime Error:\n${result.stderr}`, 'error');
        } else if (result.statusId === 5) {
            showOutput('Time Limit Exceeded', 'error');
        } else {
            const output = (result.stdout || '').trim();
            showOutput(output, 'success');
        }
    } catch (error) {
        showOutput(`Error: ${error.message}`, 'error');
    }
}

function showOutput(text, status = 'info') {
    const outputEl = document.querySelector('.output-text');
    outputEl.textContent = text;
    
    const statusEl = document.querySelector('.output-status');
    statusEl.textContent = `[${status.toUpperCase()}]`;
    statusEl.className = `output-status ${status}`;
}

// ==================== CODE SUBMISSION ====================

async function submitCode() {
    const code = document.querySelector('.code-input').value;
    if (!code.trim()) {
        showFeedback('Code is empty!', 'error');
        return;
    }
    
    const question = gameState.currentQuestion;
    const langId = LANGUAGES[gameState.currentLanguage].id;
    
    try {
        showFeedback('Submitting...', 'warning');
        const token = await submitCodeToJudge0(langId, code, question.testInput || '');
        
        // Poll for result
        let result = null;
        let attempts = 0;
        while (!result && attempts < 30) {
            await new Promise(r => setTimeout(r, 500));
            result = await getExecutionResult(token);
            attempts++;
        }
        
        if (!result) {
            showFeedback('Timeout: Code execution took too long', 'error');
            gameState.wrongAttempts++;
            return;
        }
        
        if (result.statusId === 6 || result.statusId === 7) {
            showFeedback('Code has compilation or runtime errors!', 'error');
            gameState.wrongAttempts++;
            return;
        }
        
        // Compare output
        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = question.expectedOutput.trim();
        
        if (compareOutput(actualOutput, expectedOutput)) {
            showFeedback('✓ CORRECT! Output matches expected result.', 'success');
            if (question.penalty) gameState.penaltySolved++;
            gameState.score += calculatePoints(question.difficulty);
            gameState.totalQuestionsAnswered++;
            updateScoreDisplay();
            
            // Load next question after 2 seconds
            setTimeout(() => {
                loadNextQuestion();
            }, 2000);
        } else {
            // wrong attempt: always show output and increase counter
            if (question.penalty) {
                showFeedback(`✗ WRONG (penalty)!`, 'error');
            } else {
                showFeedback(`✗ WRONG! Expected:\n${expectedOutput}\n\nGot:\n${actualOutput}`, 'error');
            }
            gameState.wrongAttempts++;
            // allocate one penalty question from pool if available
            if (gameState.penaltyPool && gameState.penaltyPool.length > 0) {
                const penQ = gameState.penaltyPool.shift();
                gameState.questionQueue.push(penQ);
                showFeedback('⚠ Penalty question added.', 'warning');
            }
            handleWrongAttempt();
        }
    } catch (error) {
        showFeedback(`Error: ${error.message}`, 'error');
        gameState.wrongAttempts++;
    }
}

function handleWrongAttempt() {
    if (gameState.wrongAttempts === 1) {
        // Change to medium difficulty
        changeDifficulty('medium');
        showFeedback('⚠ 1 Wrong: Question difficulty increased to MEDIUM', 'warning');
    } else if (gameState.wrongAttempts === 3) {
        // Change to hard difficulty
        changeDifficulty('hard');
        showFeedback('⚠ 3 Wrongs: Question difficulty increased to HARD', 'warning');
    } else if (gameState.wrongAttempts === 5) {
        // Change to very hard difficulty
        changeDifficulty('veryHard');
        showFeedback('⚠ 5 Wrongs: Question difficulty set to VERY HARD', 'warning');
    }
}

function changeDifficulty(difficulty) {
    const tag = document.querySelector('.difficulty-tag');
    tag.className = `difficulty-tag ${difficulty.toLowerCase()}`;
    tag.textContent = difficulty.toUpperCase();
}

function calculatePoints(difficulty) {
    switch (difficulty.toLowerCase()) {
        case 'medium': return 100;
        case 'hard': return 150;
        case 'veryhard': return 200;
        default: return 50;
    }
}

function compareOutput(actual, expected) {
    // Normalize both outputs: trim and split by lines
    const actualLines = actual.split('\n').map(line => line.trim()).filter(line => line);
    const expectedLines = expected.split('\n').map(line => line.trim()).filter(line => line);
    
    if (actualLines.length !== expectedLines.length) return false;
    
    for (let i = 0; i < actualLines.length; i++) {
        if (actualLines[i] !== expectedLines[i]) return false;
    }
    
    return true;
}

function showFeedback(message, type) {
    const feedbackEl = document.getElementById('result-message');
    feedbackEl.innerHTML = message.replace(/\n/g, '<br>');
    feedbackEl.className = `result-feedback ${type}`;
    feedbackEl.style.display = 'block';
}

function skipQuestion() {
    const question = gameState.currentQuestion;
    showFeedback(`Skipped: ${question.title} - Queue updated`, 'warning');
    gameState.totalQuestionsAnswered++;
    
    // Re-queue the question
    gameState.questionQueue.push(question);
    
    setTimeout(() => {
        loadNextQuestion();
    }, 1500);
}

// ==================== RESULTS PAGE ====================

// helper for formatting seconds into MM:SS
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

async function endGame() {
    // make sure server knows session finished (early or not)
    await finalizeSession();

    clearInterval(gameState.timerInterval);
    gameState.isRunning = false;
    
    // Calculate final stats
    const survived = gameState.score >= 400; // 4+ correct answers
    const accuracy = gameState.totalQuestionsAnswered > 0 
        ? Math.round((gameState.score / (gameState.totalQuestionsAnswered * 200)) * 100)
        : 0;
    
    // decide title and message based on termination reason
    const titleEl = document.querySelector('.results-title');
    const message = document.querySelector('.result-message');

    if (gameState.sessionEndedEarly) {
        if (titleEl) titleEl.textContent = 'SESSION ENDED';
        if (message) {
            message.textContent = `Session ended early. Questions completed: ${gameState.totalQuestionsAnswered}`;
            message.className = 'result-message eliminated';
        }
    } else {
        if (titleEl) titleEl.textContent = 'CHALLENGE COMPLETE';
        if (message) {
            if (survived) {
                message.textContent = '🟢 YOU SURVIVED! Great job!';
                message.className = 'result-message survived';
            } else {
                message.textContent = '🔴 ELIMINATED! Try again?';
                message.className = 'result-message eliminated';
            }
        }
    }

    // display using element IDs (so order doesn't matter)
    const scoreEl = document.getElementById('final-score');
    const solvedEl = document.getElementById('questions-solved');
    const wrongEl = document.getElementById('wrong-submissions');
    const penEl = document.getElementById('penalty-solved');
    const timeEl = document.getElementById('time-spent');
    const successEl = document.getElementById('success-rate');
    
    if (scoreEl) scoreEl.textContent = gameState.score;
    if (solvedEl) solvedEl.textContent = gameState.totalQuestionsAnswered;
    if (wrongEl) wrongEl.textContent = gameState.wrongAttempts;
    if (penEl) penEl.textContent = gameState.penaltySolved;

    // show whatever remains on timer when game ended
    if (timeEl) timeEl.textContent = formatTime(gameState.timeRemaining);

    if (successEl) successEl.textContent = accuracy + '%';
    
    // ensure we leave fullscreen after game over
    exitFullscreen();
    showPage('results-page');
}

function updateScoreDisplay() {
    const scoreEl = document.querySelector('.score-value');
    if (scoreEl) {
        scoreEl.textContent = gameState.score;
    }
}

function updateProgressDisplay() {
    const progressEl = document.querySelector('.progress-pill');
    if (progressEl) {
        progressEl.textContent = `Question ${gameState.totalQuestionsAnswered + 1}`;
    }
}

// ==================== FULLSCREEN / SESSION CONTROL ====================

async function initSession(language) {
    // attempt to create a server session (used for stats if backend is running)
    try {
        const resp = await fetch('/session/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language })
        });
        const data = await resp.json();
        if (data.sessionId) {
            gameState.sessionId = data.sessionId;
            console.log('backend session initialized', gameState.sessionId);
        }
    } catch (e) {
        console.warn('could not initialize backend session', e);
    }
}

async function finalizeSession() {
    if (!gameState.sessionId) return;
    try {
        await fetch(`/session/${gameState.sessionId}/end`, { method: 'POST' });
    } catch (e) {
        console.warn('error finalizing backend session', e);
    }
}

function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.warn('fullscreen request failed', err));
    }
}

function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function terminateSession() {
    // mark that user opted to end the session early
    gameState.sessionEndedEarly = true;
    // delegate to normal game over logic, which clears timer and exits fullscreen
    endGame();
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Script loaded and DOM ready');
    
    // Start page button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        console.log('Start button found, attaching click handler');
        startBtn.addEventListener('click', startGame);
    } else {
        console.error('Start button not found');
    }
    
    // Language selection buttons
    const pythonBtn = document.getElementById('python-btn');
    const cBtn = document.getElementById('c-btn');
    const javaBtn = document.getElementById('java-btn');
    
    if (pythonBtn) pythonBtn.addEventListener('click', () => selectLanguage('python'));
    if (cBtn) cBtn.addEventListener('click', () => selectLanguage('c'));
    if (javaBtn) javaBtn.addEventListener('click', () => selectLanguage('java'));

    // close button for ending the current session early
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Close button clicked, terminating session');
            terminateSession();
        });
    }
    
    // Code submission buttons
    const runBtn = document.getElementById('run-btn');
    const submitBtn = document.getElementById('submit-btn');
    const skipBtn = document.getElementById('skip-btn');
    
    if (runBtn) {
        runBtn.addEventListener('click', function() {
            if (gameState.runAttempts >= 3) {
                showOutput('You can only use the RUN button 3 times per question.', 'error');
                runBtn.disabled = true;
                return;
            }
            gameState.runAttempts++;
            runCode();
            if (gameState.runAttempts >= 3) {
                runBtn.disabled = true;
            }
        });
    }
    if (submitBtn) submitBtn.addEventListener('click', submitCode);
    if (skipBtn) skipBtn.addEventListener('click', skipQuestion);
    
    // Results page button
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            gameState = {
                currentLanguage: null,
                currentQuestion: null,
                currentQuestionIndex: 0,
                score: 0,
                timeRemaining: 30 * 60,
                timerInterval: null,
                questionQueue: [],
                wrongAttempts: 0,
                isRunning: false,
                totalQuestionsAnswered: 0
            };
            // leave fullscreen if still active
            exitFullscreen();
            showPage('start-page');
        });
    }
    
    // Initialize with start page
    console.log('Initializing pages...');
    showPage('start-page');
    updateTimerDisplay();
    console.log('Initialization complete');
});

