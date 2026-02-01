export interface Judge {
  name: string;
  role: string;
  company: string;
  values: string[];
  focusAreas: string[];
  redFlags: string[];
  recommendedTalkingPoints: string[];
  imageUrl?: string;
}

export interface HackathonData {
  title: string;
  url: string;
  judges: Judge[];
  criteria: string[];
  strategy: {
    structure: { time: string; action: string }[];
    keyPhrases: string[];
    featuresToEmphasize: string[];
    generatedScript: string;
  };
}

export interface RecordingMetrics {
  wpm: number;
  fillerWords: number;
  energyLevel: number;
  eyeContact: number;
  duration: number;
}

export interface AnalysisResult {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  judgeSpecificFeedback: { judgeName: string; feedback: string }[];
  qaQuestions: { question: string; answer?: string; feedback?: string }[];
}

export type AppStep = 'analyze' | 'practice' | 'results';