const express = require('express');
const { execSync, spawnSync } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// ==================== IN-MEMORY STORAGE ====================
const sessions = new Map(); // sessionId -> { language, score, queue, questionsAttempted, startTime }
const questionQueues = new Map(); // sessionId -> { originalQueue, currentQueue, solvedQuestions }

// ==================== QUESTION DATA (IN-MEMORY) ====================

const pythonQuestions = [
    // normal problems
    {
        id: 'py1',
        title: 'Reverse a String',
        description: 'The function should return the reversed string but currently returns the original.',
        buggyCode: `def reverse_string(s):
    result = ""
    for ch in s:
        reslt += ch
    return s

print(reverse_string("hello"))`,
        expectedOutput: 'olleh',
        difficulty: 'easy',
        explanation: 'Iterates forward, typo in variable name, returns wrong variable.'
    },
    {
        id: 'py2',
        title: 'Find Maximum Number',
        description: 'Should find largest element in a list; logic has multiple issues.',
        buggyCode: `def find_max(nums):
    m = nums[1]
    for n in nums:
        if n < m:
            m = n
    return n

print(find_max([3,7,2,9,1]))`,
        expectedOutput: '9',
        difficulty: 'easy',
        explanation: 'Initial value wrong, comparison reversed, returns wrong variable.'
    },
    {
        id: 'py3',
        title: 'Count Even Numbers',
        description: 'Should count evens in list but the implementation is flawed.',
        buggyCode: `def count_even(lst):
    count = 1
    for n in lst:
        if n % 2 == 0:
            cnt += 1
    return cnt

print(count_even([1,2,3,4,5]))`,
        expectedOutput: '2',
        difficulty: 'medium',
        explanation: 'Starts count incorrectly, uses undefined variable, returns incorrect variable.'
    },
    {
        id: 'py4',
        title: 'Remove Duplicates',
        description: 'Should remove duplicates from list but returns original list.',
        buggyCode: `def remove_duplicates(lst):
    seen = set()
    out = []
    for x in lst:
        if x not in seen:
            seen.add(x)
    return lst

print(remove_duplicates([1,2,2,3,3,3]))`,
        expectedOutput: '[1, 2, 3]',
        difficulty: 'medium',
        explanation: 'Doesn\'t populate output list, returns wrong value, unused variable.'
    },
    {
        id: 'py5',
        title: 'Sum of Digits',
        description: 'Should add each digit but multiple mistakes cause wrong output.',
        buggyCode: `def sum_digits(n):
    total = 0
    for d in str(n):
        total = total + 0
        total = total + int(d)
    return total + 1

print(sum_digits(123))`,
        expectedOutput: '6',
        difficulty: 'easy',
        explanation: 'Adds 0, reassigns rather than increment, and adds an extra 1.'
    },
    // penalty problems
    {
        id: 'py6',
        title: 'Palindrome Checker',
        description: 'Should report true for palindromes; has multiple errors.',
        buggyCode: `def is_palindrome(s):
    if s == "":
        return False
    return s == s[::-1] and False
    print("debug")

print(is_palindrome("radar"))`,
        expectedOutput: 'True',
        difficulty: 'medium',
        explanation: 'Empty case wrong, `and False` makes result always False, unreachable print.',
        penalty: true
    },
    {
        id: 'py7',
        title: 'Fibonacci Sequence',
        description: 'Should compute n-th fibonacci number but recurrence has errors.',
        buggyCode: `def fib(n):
    a,b = 0,1
    for _ in range(n):
        a = b
        b = a + b
    return a + 0

print(fib(5))`,
        expectedOutput: '5',
        difficulty: 'hard',
        explanation: 'Order of updates wrong, sequence shifted, extraneous addition.',
        penalty: true
    },
    {
        id: 'py8',
        title: 'Prime Test',
        description: 'Always returns False even for prime numbers.',
        buggyCode: `def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return False

print(is_prime(7))`,
        expectedOutput: 'True',
        difficulty: 'medium',
        explanation: 'Final return value is wrong; primes never flagged True.',
        penalty: true
    },
    {
        id: 'py9',
        title: 'Armstrong Number',
        description: 'Checks Armstrong numbers but has several mistakes.',
        buggyCode: `def is_armstrong(n):
    s = str(n)
    total = 0
    for ch in s:
        total += int(ch) ** 2
    return total == n
    

print(is_armstrong(153))`,
        expectedOutput: 'True',
        difficulty: 'hard',
        explanation: 'Uses fixed power 2, wrong logic for general case, unnecessary comment.',
        penalty: true
    },
    {
        id: 'py10',
        title: 'Perfect Number',
        description: 'Calculates perfect number but includes n itself.',
        buggyCode: `def is_perfect(n):
    s = 0
    for i in range(1, n+1):
        if n % i == 0:
            s += i
    return s == n
    print("done")

print(is_perfect(6))`,
        expectedOutput: 'True',
        difficulty: 'hard',
        explanation: 'Includes n in sum, uses inclusive range, unreachable print.',
        penalty: true
    }
];

const cQuestions = [
    // normal
    {
        id: 'c1',
        title: 'Reverse a String',
        description: 'Should reverse and print string but prints original.',
        buggyCode: `#include <stdio.h>
#include <string.h>
int main() {
    char s[] = "hello";
    char rev[6];
    int len = strlen(s);
    for (int i = 0; i < len; i++) {
        rev[i] = s[len-1-i];
    }
    rev[len] = '\0';
    printf("%s\n", s);
    return 0;
}`,
        expectedOutput: 'hello',
        difficulty: 'easy',
        explanation: 'Prints original string `s` instead of `rev`.'
    },
    {
        id: 'c2',
        title: 'Find Maximum Number',
        description: 'Logic picks minimum instead of maximum.',
        buggyCode: `#include <stdio.h>
int main() {
    int arr[] = {3,7,2,9,1};
    int max = arr[0];
    for (int i = 0; i < 5; i++) {
        if (arr[i] < max) {
            max = arr[i];
        }
    }
    printf("%d\n", max);
    return 0;
}`,
        expectedOutput: '9',
        difficulty: 'easy',
        explanation: 'Comparison uses `<` so `max` becomes minimum.'
    },
    {
        id: 'c3',
        title: 'Count Even Numbers',
        description: 'Variable `count` never increments.',
        buggyCode: `#include <stdio.h>
int main() {
    int arr[] = {1,2,3,4,5};
    int count = 0;
    for (int i = 0; i < 5; i++) {
        if (arr[i] % 2 == 0) {
            cnt++;
        }
    }
    printf("%d\n", count);
    return 0;
}`,
        expectedOutput: '2',
        difficulty: 'medium',
        explanation: '`count` isn’t incremented; `cnt` is undefined.'
    },
    {
        id: 'c4',
        title: 'Remove Duplicates',
        description: 'Should print unique values but prints original array.',
        buggyCode: `#include <stdio.h>
int main() {
    int arr[] = {1,2,2,3,3};
    int seen[5];
    int idx = 0;
    for (int i = 0; i < 5; i++) {
        int found = 0;
        for (int j = 0; j < idx; j++) {
            if (seen[j] == arr[i]) found = 1;
        }
        if (!found) {
            seen[idx++] = arr[i];
        }
    }
    for (int i = 0; i < 5; i++) printf("%d", arr[i]);
    printf("\n");
    return 0;
}`,
        expectedOutput: '123',
        difficulty: 'medium',
        explanation: 'Output loop uses `arr` instead of `seen`.'
    },
    {
        id: 'c5',
        title: 'Sum of Digits',
        description: 'Adds zero each iteration.',
        buggyCode: `#include <stdio.h>
int sum_digits(int n) {
    int total = 0;
    while (n > 0) {
        total += 0;
        n /= 10;
    }
    return total;
}
int main() {
    printf("%d\n", sum_digits(123));
    return 0;
}`,
        expectedOutput: '6',
        difficulty: 'easy',
        explanation: 'Should add `n % 10`, not `0`.'
    },
    // penalty
    {
        id: 'c6',
        title: 'Palindrome Checker',
        description: 'Always reports non‑palindrome.',
        buggyCode: `#include <stdio.h>
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
        expectedOutput: '1',
        difficulty: 'medium',
        explanation: 'Resets `pal` to 0 even when string is palindrome.',
        penalty: true
    },
    {
        id: 'c7',
        title: 'Fibonacci Sequence',
        description: 'Updates wrong variable order.',
        buggyCode: `#include <stdio.h>
int fib(int n) {
    int a=0,b=1;
    for (int i=0;i<n;i++) {
        a=b;
        b=a+b;
    }
    return a;
}
int main() { printf("%d\n", fib(5)); return 0; }`,
        expectedOutput: '5',
        difficulty: 'hard',
        explanation: 'Variable `a` is overwritten before computing `b`.',
        penalty: true
    },
    {
        id: 'c8',
        title: 'Prime Test',
        description: 'Always returns composite.',
        buggyCode: `#include <stdio.h>
int is_prime(int n) {
    if (n <= 1) return 0;
    for (int i=2; i<n; i++) {
        if (n % i == 0) return 0;
    }
    return 0;
}
int main() { printf("%d\n", is_prime(7)); return 0; }`,
        expectedOutput: '1',
        difficulty: 'medium',
        explanation: 'Function always returns 0 instead of 1 when prime.',
        penalty: true
    },
    {
        id: 'c9',
        title: 'Armstrong Number',
        description: 'Uses fixed power 2.',
        buggyCode: `#include <stdio.h>
#include <math.h>
int main() {
    int n=153, sum=0, temp=n;
    int digits = 0;
    while(temp>0){ digits++; temp/=10; }
    temp = n;
    while(temp>0){
        int d = temp%10;
        sum += pow(d,2);
        temp/=10;
    }
    printf("%d\n", sum==n);
    return 0;
}`,
        expectedOutput: '1',
        difficulty: 'hard',
        explanation: 'Should raise to `digits` not 2.',
        penalty: true
    },
    {
        id: 'c10',
        title: 'Perfect Number',
        description: 'Includes n itself in divisor sum.',
        buggyCode: `#include <stdio.h>
int main() {
    int n=6, sum=0;
    for(int i=1;i<=n;i++){
        if(n % i == 0) sum += i;
    }
    printf("%d\n", sum==n);
    return 0;
}`,
        expectedOutput: '1',
        difficulty: 'hard',
        explanation: 'Loop includes n; perfect number definition excludes itself.',
        penalty: true
    }
];

const javaQuestions = [
    // normal questions
    {
        id: 'java1',
        title: 'Reverse a String',
        description: 'Should print reversed string; prints original.',
        buggyCode: `public class Main {
    public static void main(String[] args) {
        String s = "hello";
        String rev = "";
        for(int i=s.length()-1;i>=0;i--) rev += s.charAt(i);
        System.out.println(s);
    }
}`,
        expectedOutput: 'hello',
        difficulty: 'easy',
        explanation: 'Printed variable is `s` instead of `rev`.'
    },
    {
        id: 'java2',
        title: 'Find Maximum Number',
        description: 'Logic selects minimum element.',
        buggyCode: `public class Main {
    public static void main(String[] args) {
        int[] arr = {3,7,2,9,1};
        int m = arr[0];
        for(int v : arr) {
            if(v < m) m = v;
        }
        System.out.println(m);
    }
}`,
        expectedOutput: '9',
        difficulty: 'easy',
        explanation: '< used instead of >.'
    },
    {
        id: 'java3',
        title: 'Count Even Numbers',
        description: 'Counter never increments.',
        buggyCode: `public class Main {
    public static void main(String[] args) {
        int[] arr = {1,2,3,4,5};
        int count = 0;
        for(int n: arr) {
            if(n%2==0) cnt++;
        }
        System.out.println(count);
    }
}`,
        expectedOutput: '2',
        difficulty: 'medium',
        explanation: 'Uses undefined variable `cnt`.'
    },
    {
        id: 'java4',
        title: 'Remove Duplicates',
        description: 'Should output unique values but prints original.',
        buggyCode: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        int[] arr = {1,2,2,3,3};
        List<Integer> seen = new ArrayList<>();
        for(int v: arr) {
            if(!seen.contains(v)) seen.add(v);
        }
        for(int v: arr) System.out.print(v);
    }
}`,
        expectedOutput: '123',
        difficulty: 'medium',
        explanation: 'Printed original array instead of unique list.'
    },
    {
        id: 'java5',
        title: 'Sum of Digits',
        description: 'Adds zero instead of digits.',
        buggyCode: `public class Main {
    public static int sumDigits(int n) {
        int tot = 0;
        while(n>0){
            tot += 0;
            n /= 10;
        }
        return tot;
    }
    public static void main(String[] args){
        System.out.println(sumDigits(123));
    }
}`,
        expectedOutput: '6',
        difficulty: 'easy',
        explanation: 'Should add `n%10` not 0.'
    },
    // penalty questions
    {
        id: 'java6',
        title: 'Palindrome Checker',
        description: 'Always returns false for palindromes.',
        buggyCode: `public class Main {
    public static boolean isPal(String s) {
        return new StringBuilder(s).reverse().toString().equals(s) && false;
    }
    public static void main(String[] args){
        System.out.println(isPal("radar"));
    }
}`,
        expectedOutput: 'true',
        difficulty: 'medium',
        explanation: 'Expression ends with `&& false` forcing false.',
        penalty: true
    },
    {
        id: 'java7',
        title: 'Fibonacci Sequence',
        description: 'Recurrence updates wrong variable order.',
        buggyCode: `public class Main {
    public static int fib(int n) {
        int a=0,b=1;
        for(int i=0;i<n;i++){
            a=b;
            b=a+b;
        }
        return a;
    }
    public static void main(String[] args){
        System.out.println(fib(5));
    }
}`,
        expectedOutput: '5',
        difficulty: 'hard',
        explanation: 'a is set before computing b.',
        penalty: true
    },
    {
        id: 'java8',
        title: 'Prime Test',
        description: 'Function always returns false.',
        buggyCode: `public class Main {
    public static boolean isPrime(int n) {
        if(n<=1) return false;
        for(int i=2;i<n;i++){
            if(n%i==0) return false;
        }
        return false;
    }
    public static void main(String[] args){
        System.out.println(isPrime(7));
    }
}`,
        expectedOutput: 'true',
        difficulty: 'medium',
        explanation: 'Should return true when no divisors found.',
        penalty: true
    },
    {
        id: 'java9',
        title: 'Armstrong Number',
        description: 'Uses power of 2 instead of digit count.',
        buggyCode: `public class Main {
    public static boolean isArm(int n) {
        int sum=0, temp=n;
        while(temp>0){
            int d = temp%10;
            sum += Math.pow(d,2);
            temp/=10;
        }
        return sum==n;
    }
    public static void main(String[] args){
        System.out.println(isArm(153));
    }
}`,
        expectedOutput: 'true',
        difficulty: 'hard',
        explanation: 'Exponent should be number of digits.',
        penalty: true
    },
    {
        id: 'java10',
        title: 'Perfect Number',
        description: 'Sums all divisors including n itself.',
        buggyCode: `public class Main {
    public static boolean isPerfect(int n){
        int sum=0;
        for(int i=1;i<=n;i++) if(n%i==0) sum+=i;
        return sum==n;
    }
    public static void main(String[] args){
        System.out.println(isPerfect(6));
    }
}`,
        expectedOutput: 'true',
        difficulty: 'hard',
        explanation: 'Loop should exclude n itself.',
        penalty: true
    }
];

const allQuestions = {
    'Python': pythonQuestions,
    'C': cQuestions,
    'Java': javaQuestions
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Initialize a new session with a shuffled question queue
 */
function initializeSession(language, sessionId) {
    const questions = allQuestions[language];
    // split normals and penalties
    const normals = questions.filter(q => !q.penalty);
    const penalties = questions.filter(q => q.penalty);
    const shuffledNormals = [...normals].sort(() => Math.random() - 0.5);

    sessions.set(sessionId, {
        language,
        score: 0,
        questionsAttempted: 0,
        questionsSolved: 0,
        penaltyCount: 0,
        startTime: Date.now(),
        endTime: null
    });

    questionQueues.set(sessionId, {
        // currentQueue initially contains only normals
        originalQueue: shuffledNormals.map(q => q.id),
        currentQueue: shuffledNormals.map(q => q.id),
        solvedQuestions: [],
        unsolvedQuestions: [],
        penaltyPool: penalties.map(q => q.id) // will be consumed on wrong answers
    });

    return shuffledNormals[0];
} 

/**
 * Get question by ID
 */
function getQuestion(questionId, language) {
    return allQuestions[language].find(q => q.id === questionId);
}

/**
 * Get next question from current queue
 */
function getNextQuestion(sessionId) {
    const queue = questionQueues.get(sessionId);
    if (!queue || queue.currentQueue.length === 0) {
        return null;
    }
    const questionId = queue.currentQueue[0];
    const session = sessions.get(sessionId);
    return getQuestion(questionId, session.language);
} // (no change needed here) 

/**
 * Handle submission: update queue and score
 */
function handleSubmission(sessionId, questionId, isCorrect) {
    const queue = questionQueues.get(sessionId);
    const session = sessions.get(sessionId);

    // Remove current question from queue
    queue.currentQueue.shift();

    session.questionsAttempted++;

    if (isCorrect) {
        queue.solvedQuestions.push(questionId);
        session.score += 5;
        session.questionsSolved++;
    } else {
        // wrong answer: do not repeat this question
        queue.unsolvedQuestions.push(questionId);
        // allocate one penalty question (if available)
        if (queue.penaltyPool && queue.penaltyPool.length > 0) {
            const penId = queue.penaltyPool.shift();
            queue.currentQueue.push(penId);
            session.penaltyCount = (session.penaltyCount || 0) + 1;
        }
    }

    // Check if test is complete
    const isComplete = queue.currentQueue.length === 0;
    if (isComplete) {
        session.endTime = Date.now();
    }

    return { session, isComplete };
}

/**
 * Execute code using child_process (with proper multi-language support)
 * Handles Python, C, and Java with proper error handling and timeouts
 */
function executeCode(code, language) {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    let sourceFile, outputFile, compileCommand, runCommand, isExecutable = false;
    const filesToClean = [];

    try {
        switch (language.toLowerCase()) {
            case 'python':
                // ========== PYTHON EXECUTION ==========
                sourceFile = path.join(tempDir, `script_${timestamp}.py`);
                fs.writeFileSync(sourceFile, code, 'utf-8');
                filesToClean.push(sourceFile);

                // Run directly with python
                runCommand = ['python', sourceFile];
                break;

            case 'c':
                // ========== C EXECUTION ==========
                sourceFile = path.join(tempDir, `program_${timestamp}.c`);
                // Platform-specific executable name
                outputFile = path.join(
                    tempDir, 
                    os.platform() === 'win32' 
                        ? `program_${timestamp}.exe` 
                        : `program_${timestamp}`
                );
                
                fs.writeFileSync(sourceFile, code, 'utf-8');
                filesToClean.push(sourceFile, outputFile);

                // Compile C code
                const compileResult = spawnSync('gcc', [sourceFile, '-o', outputFile], {
                    timeout: 5000,
                    encoding: 'utf-8',
                    maxBuffer: 10 * 1024 * 1024
                });

                if (compileResult.error || compileResult.status !== 0) {
                    return {
                        success: false,
                        output: '',
                        error: compileResult.stderr || compileResult.error?.message || 'Compilation failed',
                        compileError: true
                    };
                }

                // Run compiled executable
                runCommand = [outputFile];
                isExecutable = true;
                break;

            case 'java':
                // ========== JAVA EXECUTION ==========
                // Use fixed name "Main.java" - Java requires class name to match filename
                sourceFile = path.join(tempDir, `Main.java`);
                const classFile = path.join(tempDir, 'Main.class');
                
                // ensure user not accidentally using wrong public class name
                if (/public\s+class\s+Solution\b/.test(code)) {
                    code = code.replace(/public\s+class\s+Solution\b/g, 'public class Main');
                }

                fs.writeFileSync(sourceFile, code, 'utf-8');
                filesToClean.push(sourceFile, classFile);

                // Compile Java code - compile in the temp directory so .class is created there
                const javaCompileResult = spawnSync('javac', [sourceFile], {
                    timeout: 5000,
                    cwd: tempDir,
                    encoding: 'utf-8',
                    maxBuffer: 10 * 1024 * 1024
                });

                if (javaCompileResult.error || javaCompileResult.status !== 0) {
                    return {
                        success: false,
                        output: '',
                        error: javaCompileResult.stderr || javaCompileResult.error?.message || 'Compilation failed',
                        compileError: true
                    };
                }

                // Run Java class - specify classpath and class name (without .class)
                runCommand = ['java', '-cp', tempDir, 'Main'];
                isExecutable = true;
                break;

            default:
                return {
                    success: false,
                    output: '',
                    error: `Unsupported language: ${language}`
                };
        }

        // ========== EXECUTE THE CODE ==========
        const result = spawnSync(runCommand[0], runCommand.slice(1), {
            timeout: 5000,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        if (result.error) {
            // Timeout or spawn error
            if (result.error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    output: result.stdout || '',
                    error: 'Execution timeout (5 seconds limit). Possible infinite loop.'
                };
            }
            return {
                success: false,
                output: result.stdout || '',
                error: result.error.message || 'Execution failed'
            };
        }

        // Check exit code
        if (result.status !== 0 && result.status !== null) {
            return {
                success: false,
                output: result.stdout || '',
                error: result.stderr || `Program exited with code ${result.status}`
            };
        }

        return {
            success: true,
            output: result.stdout || '',
            error: result.stderr || '',
            compileError: false
        };

    } catch (error) {
        return {
            success: false,
            output: '',
            error: error.message || 'Unknown error during execution'
        };
    } finally {
        // ========== CLEANUP TEMP FILES ==========
        filesToClean.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (e) {
                // Silently ignore cleanup errors
            }
        });
    }
}

// ==================== API ROUTES ====================

/**
 * GET /questions/:language
 * Get all questions for a language
 */
app.get('/questions/:language', (req, res) => {
    const { language } = req.params;
    const questions = allQuestions[language];

    if (!questions) {
        return res.status(404).json({ error: 'Language not found' });
    }

    // Return without expectedOutput for security
    const publicQuestions = questions.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description,
        buggyCode: q.buggyCode,
        difficulty: q.difficulty
    }));

    res.json(publicQuestions);
});

/**
 * POST /session/init
 * Initialize a new session
 */
app.post('/session/init', (req, res) => {
    const { language } = req.body;

    if (!allQuestions[language]) {
        return res.status(400).json({ error: 'Invalid language' });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const firstQuestion = initializeSession(language, sessionId);

    const total = allQuestions[language].length;
    res.json({
        sessionId,
        language,
        question: {
            id: firstQuestion.id,
            title: firstQuestion.title,
            description: firstQuestion.description,
            buggyCode: firstQuestion.buggyCode,
            difficulty: firstQuestion.difficulty
        },
        progress: {
            current: 1,
            total
        }
    });
});

/**
 * GET /session/:sessionId/question
 * Get the next question
 */
app.get('/session/:sessionId/question', (req, res) => {
    const { sessionId } = req.params;

    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const question = getNextQuestion(sessionId);

    if (!question) {
        return res.json({ completed: true });
    }

    const queue = questionQueues.get(sessionId);
    const total = allQuestions[sessions.get(sessionId).language].length;
    const progress = {
        current: total - queue.currentQueue.length,
        total
    };

    res.json({
        question: {
            id: question.id,
            title: question.title,
            description: question.description,
            buggyCode: question.buggyCode,
            difficulty: question.difficulty
        },
        progress
    });
});

/**
 * POST /session/:sessionId/submit
 * Submit code and validate
 */
app.post('/session/:sessionId/submit', (req, res) => {
    const { sessionId } = req.params;
    const { code, questionId } = req.body;

    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions.get(sessionId);
    const question = getQuestion(questionId, session.language);

    if (!question) {
        return res.status(404).json({ error: 'Question not found' });
    }

    // Execute the code
    const executionResult = executeCode(code, session.language);
    
    // Normalize line endings and trim for robust comparison (handles CRLF vs LF)
    const normalize = s => (s || '').replace(/\r\n/g, '\n').trim();
    const stdout = normalize(executionResult.output);
    const expectedOutput = normalize(question.expectedOutput);

    // Check if correct (only if execution was successful)
    const isCorrect = executionResult.success && stdout === expectedOutput;

    // Update queue and session
    const { session: updatedSession, isComplete } = handleSubmission(sessionId, questionId, isCorrect);

    res.json({
        isCorrect,
        output: executionResult.output,
        errors: executionResult.error || '',
        compileError: executionResult.compileError || false,
        expectedOutput: question.expectedOutput,
        explanation: question.explanation,
        score: updatedSession.score,
        questionsAttempted: updatedSession.questionsAttempted,
        questionsSolved: updatedSession.questionsSolved,
        testComplete: isComplete
    });
});

/**
 * POST /session/:sessionId/run
 * Run code without submitting (show output only)
 */
app.post('/session/:sessionId/run', (req, res) => {
    const { sessionId } = req.params;
    const { code, language } = req.body;

    if (!sessions.has(sessionId) && !language) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const executionResult = executeCode(code, language || sessions.get(sessionId).language);

    res.json({
        success: executionResult.success,
        output: executionResult.output,
        errors: executionResult.error || '',
        compileError: executionResult.compileError || false
    });
});

/**
 * POST /session/:sessionId/end
 * Mark session as finished (early exit or normal completion)
 */
app.post('/session/:sessionId/end', (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessions.get(sessionId);
    if (!session.endTime) {
        session.endTime = Date.now();
    }
    res.json({ message: 'Session ended', sessionId });
});

/**
 * GET /session/:sessionId/stats
 * Get session statistics
 */
app.get('/session/:sessionId/stats', (req, res) => {
    const { sessionId } = req.params;

    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions.get(sessionId);
    const timespent = session.endTime ? 
        Math.round((session.endTime - session.startTime) / 1000) : 
        Math.round((Date.now() - session.startTime) / 1000);

    res.json({
        score: session.score,
        questionsAttempted: session.questionsAttempted,
        questionsSolved: session.questionsSolved,
        penaltyCount: session.penaltyCount || 0,
        timeSpent: timespent,
        timespentFormatted: formatTime(timespent),
        language: session.language
    });
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== UTILITY ====================

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`\n🚀 Code Debugging Server Started`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`\n📚 Languages: Python, C, Java`);
    const perLang = allQuestions['Python'] ? allQuestions['Python'].length : '?';
    console.log(`❓ Questions per language: ${perLang}`);
    console.log(`⏱️  Timer: 30 minutes`);
    console.log(`💾 Storage: In-Memory (No Database)\n`);
});

server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`ERROR: Port ${PORT} already in use. Please free it or set PORT env variable.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});

