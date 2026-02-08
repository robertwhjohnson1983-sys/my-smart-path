export interface RecruiterAnalysis {
  section1: {
    score: number;
    audit: string;
    verdict: string;
  };
  section2: {
    score: number | null;
    analysis: string;
    matchVerdict: string;
    top3Fits: string[];
    top3Gaps: string[];
    actionStep: string;
  };
  transferableSkills: Array<{
    skill: string;
    relevance: string;
    strength: number;
  }>;
}
