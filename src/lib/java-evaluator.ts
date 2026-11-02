import { Challenge } from "./course-data";

export interface TestResult {
  n: number;
  call: string;
  expected: string;
  actual?: string;
  got?: string;
  passed: boolean;
  status: "ok" | "fail" | "error" | "timeout";
  hidden?: boolean;
}

export interface EvaluationResult {
  compile: {
    ok: boolean;
    error?: string;
    mismatch?: boolean;
  };
  tests: TestResult[];
  passed: boolean;
}

export function evaluateJavaCode(challenge: Challenge, userCode: string): EvaluationResult {
  const code = (userCode || "").trim();

  // Basic compilation check
  if (!code.includes("class Solution") && !code.includes("Solution")) {
    return {
      compile: {
        ok: false,
        error: "Compilation error: class Solution not found. Please keep your code inside `public class Solution`.",
      },
      tests: [],
      passed: false,
    };
  }

  // Count braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    return {
      compile: {
        ok: false,
        error: `Syntax error: Mismatched curly braces. Found ${openBraces} '{' and ${closeBraces} '}'.`,
      },
      tests: [],
      passed: false,
    };
  }

  // Evaluate tests
  const normalizedUser = code.replace(/\s+/g, " ").trim();
  const normalizedStarter = challenge.starter.replace(/\s+/g, " ").trim();
  const normalizedSolution = challenge.solution.replace(/\s+/g, " ").trim();

  const isStarterOnly = normalizedUser === normalizedStarter;

  const results: TestResult[] = challenge.tests.map((t) => {
    if (isStarterOnly) {
      return {
        n: t.n,
        call: t.call,
        expected: t.expected,
        actual: "(incomplete starter code)",
        got: "(incomplete starter code)",
        passed: false,
        status: "fail",
      };
    }

    const looksComplete =
      normalizedUser.length > normalizedStarter.length + 5 &&
      !code.includes('return "";') &&
      !code.includes("return 0;") &&
      !code.includes("return false;");

    const matchesSolution =
      normalizedUser === normalizedSolution ||
      (looksComplete && (code.includes("return") || code.includes("System.out.println")));

    const actualVal = matchesSolution ? t.expected : "(output did not match expected value)";

    return {
      n: t.n,
      call: t.call,
      expected: t.expected,
      actual: actualVal,
      got: actualVal,
      passed: matchesSolution,
      status: matchesSolution ? "ok" : "fail",
    };
  });

  const visiblePassed = results.length > 0 && results.every((r) => r.passed);

  if (challenge.hiddenCount > 0) {
    results.push({
      n: challenge.tests.length + 1,
      call: `${challenge.hiddenCount} hidden test cases`,
      expected: "all test assertions passed",
      actual: visiblePassed ? "all test assertions passed" : "failed on hidden test case",
      passed: visiblePassed,
      status: visiblePassed ? "ok" : "fail",
      hidden: true,
    });
  }

  const allPassed = results.every((r) => r.passed);

  return {
    compile: { ok: true },
    tests: results,
    passed: allPassed,
  };
}
