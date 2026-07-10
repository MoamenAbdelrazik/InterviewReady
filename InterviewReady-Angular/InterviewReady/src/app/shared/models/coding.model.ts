/**
 * Coding question received from POST /user/interviews/start
 * `score` is the MAX possible score (EASY=10, MEDIUM=20).
 * Frontend passes this as-is to the backend; LLM evaluates actual earned score.
 * `starterCode` contains language-specific implementations (Java, C++, Python, JavaScript).
 * Backend payloads may also use lower-case keys or the `starter code` field name.
 */
export type CodingStarterCode = Partial<Record<
  'Java' | 'CPP' | 'Python' | 'JavaScript' | 'java' | 'cpp' | 'python' | 'javascript' | 'js',
  string
>>;

export interface Coding {
  title?: string;  // problem name (new field from backend)
  problem: string;
  description?: string;
  input: string[];
  output: string[];
  constraints: string[];
  starterCode?: CodingStarterCode;  // multi-language starter code template from backend
  'starter code'?: CodingStarterCode;  // alternate backend field name
  starter_code?: CodingStarterCode;   // alternate backend field name
  score: number;         // MAX score: EASY=10, MEDIUM=20
  avgTimeSec: number;    // benchmark average time (seconds)
  difficultyLevel?: string;
}
