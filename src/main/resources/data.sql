-- ══════════════════════════════════════════════════════════════
-- SEED DATA — InterviewReady
-- Runs automatically on startup (spring.jpa.hibernate.ddl-auto=update)
-- ══════════════════════════════════════════════════════════════

-- Subscription Plans
INSERT INTO subscription (plan_name, price, credits) VALUES ('Free', 0.00, 2)      ON CONFLICT (plan_name) DO NOTHING;
INSERT INTO subscription (plan_name, price, credits) VALUES ('Basic', 9.99, 5)     ON CONFLICT (plan_name) DO NOTHING;
INSERT INTO subscription (plan_name, price, credits) VALUES ('Premium', 29.99, 10) ON CONFLICT (plan_name) DO NOTHING;

-- Job Profile Templates (normalized titles for dedup matching)
INSERT INTO job_profile (normalized_title) VALUES ('backend engineer')   ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('frontend engineer') ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('full stack')         ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('machine learning')   ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('devops engineer')   ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('data engineer')     ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('mobile engineer')   ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('system design')     ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('security engineer') ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('cloud architect')   ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('qa engineer')       ON CONFLICT (normalized_title) DO NOTHING;
INSERT INTO job_profile (normalized_title) VALUES ('database administrator') ON CONFLICT (normalized_title) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- MCQ QUESTIONS — 1 per role (12 total)
-- ══════════════════════════════════════════════════════════════

-- 1. Backend Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'What is the primary purpose of connection pooling in a backend application?',
       '["Reduce CSS bundle size","Reuse existing database connections to reduce overhead","Enable client-side caching","Distribute static assets across CDNs"]'::jsonb,
       'Reuse existing database connections to reduce overhead', 'MEDIUM', 10, 45
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'What is the primary purpose of connection pooling in a backend application?');

-- 2. Frontend Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'Which React hook is used to perform side effects in a functional component?',
       '["useState","useEffect","useReducer","useMemo"]'::jsonb,
       'useEffect', 'EASY', 5, 30
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'Which React hook is used to perform side effects in a functional component?');

-- 3. Full Stack
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'In a REST API, which HTTP method is idempotent and used to update a resource entirely?',
       '["POST","PATCH","PUT","DELETE"]'::jsonb,
       'PUT', 'MEDIUM', 10, 45
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'In a REST API, which HTTP method is idempotent and used to update a resource entirely?');

-- 4. Machine Learning
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'Which regularization technique randomly drops neurons during training to prevent overfitting?',
       '["L1 Regularization","Batch Normalization","Dropout","Early Stopping"]'::jsonb,
       'Dropout', 'MEDIUM', 10, 45
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'Which regularization technique randomly drops neurons during training to prevent overfitting?');

-- 5. DevOps Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'What does a Kubernetes Pod represent?',
       '["A virtual machine","The smallest deployable unit containing one or more containers","A load balancer","A persistent storage volume"]'::jsonb,
       'The smallest deployable unit containing one or more containers', 'EASY', 5, 30
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'What does a Kubernetes Pod represent?');

-- 6. Data Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'In Apache Spark, what is the primary abstraction for a distributed collection of data?',
       '["DataFrame","DataStream","RDD","DataSet"]'::jsonb,
       'RDD', 'MEDIUM', 10, 45
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'In Apache Spark, what is the primary abstraction for a distributed collection of data?');

-- 7. Mobile Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'In Android development, which component is used to perform long-running operations in the background?',
       '["Activity","Fragment","WorkManager","BroadcastReceiver"]'::jsonb,
       'WorkManager', 'MEDIUM', 10, 45
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'In Android development, which component is used to perform long-running operations in the background?');

-- 8. System Design
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'Which consistency model guarantees that all reads after a write will see that write?',
       '["Eventual consistency","Causal consistency","Strong consistency","Read-your-writes consistency"]'::jsonb,
       'Strong consistency', 'HARD', 20, 60
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'Which consistency model guarantees that all reads after a write will see that write?');

-- 9. Security Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'What type of attack involves injecting malicious scripts into web pages viewed by other users?',
       '["SQL Injection","Cross-Site Scripting (XSS)","CSRF","Man-in-the-Middle"]'::jsonb,
       'Cross-Site Scripting (XSS)', 'EASY', 5, 30
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'What type of attack involves injecting malicious scripts into web pages viewed by other users?');

-- 10. Cloud Architect
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'Which AWS service provides serverless compute that runs code in response to events?',
       '["EC2","ECS","Lambda","Fargate"]'::jsonb,
       'Lambda', 'EASY', 5, 30
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'Which AWS service provides serverless compute that runs code in response to events?');

-- 11. QA Engineer
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'What is the main difference between black-box testing and white-box testing?',
       '["Black-box tests the UI only","White-box tests examine internal code structure while black-box tests only inputs and outputs","White-box is automated and black-box is manual","There is no difference"]'::jsonb,
       'White-box tests examine internal code structure while black-box tests only inputs and outputs', 'EASY', 5, 30
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'What is the main difference between black-box testing and white-box testing?');

-- 12. Database Administrator
INSERT INTO mcq_question (question_text, choices, correct_answer, difficulty, score, average_time_sec)
SELECT 'What does ACID stand for in database transactions?',
       '["Automated, Consistent, Isolated, Durable","Atomicity, Consistency, Isolation, Durability","Asynchronous, Concurrent, Independent, Distributed","Atomic, Cached, Indexed, Distributed"]'::jsonb,
       'Atomicity, Consistency, Isolation, Durability', 'EASY', 5, 30
WHERE NOT EXISTS (SELECT 1 FROM mcq_question WHERE question_text = 'What does ACID stand for in database transactions?');

-- ══════════════════════════════════════════════════════════════
-- LINK MCQs TO JOB PROFILES (join table)
-- ══════════════════════════════════════════════════════════════

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'backend engineer'
  AND mq.question_text = 'What is the primary purpose of connection pooling in a backend application?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'frontend engineer'
  AND mq.question_text = 'Which React hook is used to perform side effects in a functional component?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'full stack'
  AND mq.question_text = 'In a REST API, which HTTP method is idempotent and used to update a resource entirely?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'machine learning'
  AND mq.question_text = 'Which regularization technique randomly drops neurons during training to prevent overfitting?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'devops engineer'
  AND mq.question_text = 'What does a Kubernetes Pod represent?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'data engineer'
  AND mq.question_text = 'In Apache Spark, what is the primary abstraction for a distributed collection of data?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'mobile engineer'
  AND mq.question_text = 'In Android development, which component is used to perform long-running operations in the background?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'system design'
  AND mq.question_text = 'Which consistency model guarantees that all reads after a write will see that write?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'security engineer'
  AND mq.question_text = 'What type of attack involves injecting malicious scripts into web pages viewed by other users?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'cloud architect'
  AND mq.question_text = 'Which AWS service provides serverless compute that runs code in response to events?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'qa engineer'
  AND mq.question_text = 'What is the main difference between black-box testing and white-box testing?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

INSERT INTO job_profile_mcq (job_profile_id, mcq_question_id)
SELECT jp.id, mq.id FROM job_profile jp, mcq_question mq
WHERE jp.normalized_title = 'database administrator'
  AND mq.question_text = 'What does ACID stand for in database transactions?'
  AND NOT EXISTS (SELECT 1 FROM job_profile_mcq WHERE job_profile_id = jp.id AND mcq_question_id = mq.id);

-- ══════════════════════════════════════════════════════════════
-- CODING QUESTIONS — 2 seed questions for Mode B template
-- ══════════════════════════════════════════════════════════════

INSERT INTO coding_question (title, problem_statement, inputs, outputs, constraints, difficulty, score, average_time_sec, starter_code)
SELECT 'Two Sum',
       'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. You may assume each input has exactly one solution, and you may not use the same element twice.',
       '["nums = [2,7,11,15], target = 9","nums = [3,2,4], target = 6"]'::jsonb,
       '["[0,1]","[1,2]"]'::jsonb,
       '["2 <= nums.length <= 10^4","-10^9 <= nums[i] <= 10^9","Only one valid answer exists"]'::jsonb,
       'EASY', 15, 300,
       '{"java":"class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}","python":"class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Write your solution here\n        pass","cpp":"class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};","javascript":"function twoSum(nums, target) {\n    // Write your solution here\n    return [];\n}"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM coding_question WHERE title = 'Two Sum');

INSERT INTO coding_question (title, problem_statement, inputs, outputs, constraints, difficulty, score, average_time_sec, starter_code)
SELECT 'Valid Parentheses',
       'Given a string `s` containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid. A string is valid if open brackets are closed by the same type and in the correct order.',
       '["s = \"()\"","s = \"()[]{}\"","s = \"(]\""]'::jsonb,
       '["true","true","false"]'::jsonb,
       '["1 <= s.length <= 10^4","s consists of parentheses only: ()[]{}"]'::jsonb,
       'MEDIUM', 20, 420,
       '{"java":"class Solution {\n    public boolean isValid(String s) {\n        // Write your solution here\n        return false;\n    }\n}","python":"class Solution:\n    def isValid(self, s: str) -> bool:\n        # Write your solution here\n        pass","cpp":"class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your solution here\n        return false;\n    }\n};","javascript":"function isValid(s) {\n    // Write your solution here\n    return false;\n}"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM coding_question WHERE title = 'Valid Parentheses');
