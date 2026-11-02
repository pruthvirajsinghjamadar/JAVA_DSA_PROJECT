import courseData from "../../data/course-data.json";

export interface Level {
  id: number;
  title: string;
  summary: string;
}

export interface Task {
  id: number;
  task: string;
}

export interface QuizQuestion {
  id: number;
  q: string;
  opts: string[];
  ans: number;
  e: string;
}

export interface Challenge {
  id: number;
  position: number;
  difficulty: "easy" | "medium" | "hard";
  title: string;
  prompt: string;
  hint: string;
  solution: string;
  starter: string;
  tests: { n: number; call: string; expected: string }[];
  hiddenCount: number;
  allTests: number;
}

export interface SheetProblem {
  key: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  url: string;
}

export interface SheetTopic {
  name: string;
  problems: SheetProblem[];
}

export interface ResourceItem {
  tag: string;
  name: string;
  description: string;
  url: string;
}

export interface Topic {
  id: number;
  level_id: number;
  position: number;
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  lesson: string;
  tasks: Task[];
  quiz: QuizQuestion[];
  needs: string[];
}

export const D = courseData as {
  levels: Level[];
  topics: Topic[];
  challenges: Record<string, Challenge[]>;
  sheet: SheetTopic[];
  resources: ResourceItem[];
};

export const PASS_MARK = 0.8;
export const CODE_PASS_MARK = 0.75;

export function getLevelById(id: number) {
  return D.levels.find((l) => l.id === id);
}

export function getTopicBySlug(slug: string) {
  return D.topics.find((t) => t.slug === slug);
}

export function getTopicById(id: number) {
  return D.topics.find((t) => t.id === id);
}

export function getChallengesForTopic(topicId: number): Challenge[] {
  return D.challenges[String(topicId)] || [];
}

export function getChallengeById(challengeId: number): { challenge: Challenge; topic: Topic } | null {
  for (const t of D.topics) {
    const list = D.challenges[String(t.id)] || [];
    const found = list.find((c) => c.id === challengeId);
    if (found) return { challenge: found, topic: t };
  }
  return null;
}

export function estimateTopicTime(topic: Topic) {
  const challenges = getChallengesForTopic(topic.id);
  const read = topic.minutes;
  const practice = topic.tasks.length * 5;
  const quiz = 5;
  const code = challenges.length * 8;
  return {
    read,
    practice,
    quiz,
    code,
    total: read + practice + quiz + code,
  };
}

// Question of the day calculation
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function getTodayKey(offsetMinutes = 330): string {
  const ms = Date.now() + offsetMinutes * 60000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function getDailyChallenge(day: string = getTodayKey()) {
  const pool = D.topics.flatMap((t) =>
    (D.challenges[String(t.id)] || [])
      .filter((c) => c.difficulty !== "hard")
      .map((c) => ({
        ...c,
        topicSlug: t.slug,
        topicTitle: t.title,
      }))
  );
  if (!pool.length) return null;
  let k = 7;
  while (gcd(k, pool.length) !== 1) k++;
  const dayMs = Date.parse(day + "T00:00:00Z");
  const idx = (Math.floor(dayMs / 86400000) * k) % pool.length;
  return pool[(idx + pool.length) % pool.length];
}
