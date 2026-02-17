export interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminDashboard {
  total_users: number;
  total_quizzes: number;
  total_sessions: number;
  active_sessions: number;
  recent_users: AdminUser[];
  recent_sessions: AdminSessionItem[];
}

export interface AdminQuizItem {
  id: string;
  title: string;
  description: string;
  owner_email: string;
  owner_name: string;
  question_count: number;
  session_count: number;
  created_at: string;
}

export interface AdminSessionItem {
  id: string;
  code: string;
  status: string;
  quiz_title: string;
  owner_name: string;
  participant_count: number;
  created_at: string;
}

export interface Answer {
  id: string;
  text: string;
  is_correct: boolean;
  order: number;
}

export interface AnswerCreate {
  text: string;
  is_correct: boolean;
  order: number;
}

export interface Question {
  id: string;
  text: string;
  order: number;
  time_limit: number;
  image_url?: string | null;
  answers: Answer[];
}

export interface QuestionCreate {
  text: string;
  order: number;
  time_limit: number;
  image_url?: string | null;
  answers: AnswerCreate[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  questions: Question[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  question_count: number;
}

export interface Session {
  id: string;
  quiz_id: string;
  owner_id: string;
  code: string;
  status: string;
  current_question_idx: number;
  created_at: string;
  participants: Participant[];
}

export interface SessionParticipant {
  nickname: string;
  score: number;
}

export interface SessionSummary {
  id: string;
  quiz_id: string;
  code: string;
  status: string;
  created_at: string;
  quiz_title: string;
  participant_count: number;
  participants: SessionParticipant[];
}

export interface Participant {
  id: string;
  nickname: string;
  score: number;
  joined_at: string;
}

export interface LeaderboardEntry {
  participant_id: string;
  nickname: string;
  score: number;
  rank: number;
}

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}
