import { D, Topic, PASS_MARK, CODE_PASS_MARK, getTopicById, getLevelById, getChallengesForTopic, estimateTopicTime } from "./course-data";
import { ClientStore, logActivity, generateCertCode } from "./db";

export function getBestQuizScore(store: ClientStore, topicId: number) {
  const attempts = store.attempts.filter((a) => a.topicId === topicId);
  return {
    score: attempts.length ? Math.max(...attempts.map((a) => a.score)) : null,
    passed: attempts.some((a) => a.passed),
  };
}

export function getCodingStats(store: ClientStore, topic: Topic) {
  const list = getChallengesForTopic(topic.id);
  const total = list.length;
  const solved = list.filter((c) => store.code[c.id] && store.code[c.id].passed).length;
  const required = total ? Math.max(1, Math.ceil(total * CODE_PASS_MARK - 1e-9)) : 0;
  return { total, required, solved };
}

export function getCertOf(store: ClientStore, kind: "topic" | "level" | "course", refId: number) {
  return store.certs.find((c) => c.kind === kind && c.refId === refId)?.code || null;
}

export function issueCertificate(
  store: ClientStore,
  kind: "topic" | "level" | "course",
  refId: number,
  score: number | null = null,
  total: number | null = null
) {
  const existing = store.certs.find((c) => c.kind === kind && c.refId === refId);
  if (existing) return { code: existing.code, isNew: false };

  const code = generateCertCode();
  const cert = {
    code,
    kind,
    refId,
    score,
    total,
    issuedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  store.certs.push(cert);
  return { code, isNew: true };
}

export function tryCertifyTopic(store: ClientStore, topic: Topic) {
  const best = getBestQuizScore(store, topic.id);
  const codeStats = getCodingStats(store, topic);

  if (!best.passed || codeStats.solved < codeStats.required) {
    return null;
  }

  const topicCert = issueCertificate(store, "topic", topic.id, best.score, topic.quiz.length);
  const milestones: { kind: string; code: string; title: string }[] = [];

  const certifiedTopics = new Set(store.certs.filter((c) => c.kind === "topic").map((c) => c.refId));

  // Check level certification
  const levelTopics = D.topics.filter((t) => t.level_id === topic.level_id);
  if (levelTopics.every((t) => certifiedTopics.has(t.id))) {
    const levelCert = issueCertificate(store, "level", topic.level_id);
    if (levelCert.isNew) {
      milestones.push({
        kind: "level",
        code: levelCert.code,
        title: getLevelById(topic.level_id)?.title || "",
      });
    }
  }

  // Check full course certification
  if (D.topics.every((t) => certifiedTopics.has(t.id))) {
    const courseCert = issueCertificate(store, "course", 0);
    if (courseCert.isNew) {
      milestones.push({
        kind: "course",
        code: courseCert.code,
        title: "Java + DSA: Complete Course",
      });
    }
  }

  return {
    certificate: { code: topicCert.code, isNew: topicCert.isNew },
    milestones,
  };
}
