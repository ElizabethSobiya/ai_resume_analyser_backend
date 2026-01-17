import { z } from 'zod';

// Extracted skills from a resume
export interface ExtractedSkills {
  technicalSkills: string[];
  frameworks: string[];
  languages: string[];
  tools: string[];
  softSkills: string[];
  yearsOfExperience?: number;
  currentRole?: string;
  education?: string[];
  certifications?: string[];
}

// Skill gap analysis result
export interface SkillGap {
  missing: string[];
  matched: string[];
  partial: string[];
}

// Match result between resume and job
export interface MatchResult {
  similarityScore: number;
  skillGaps: SkillGap;
  matchedSkills: string[];
  interviewQuestions: string[];
  recommendations: string[];
}

// Resume upload response
export interface ResumeUploadResponse {
  id: string;
  fileName: string;
  extractedSkills: ExtractedSkills;
  vectorId: string | null;
  createdAt: Date;
}

// Job match request
export interface JobMatchRequest {
  resumeId: string;
  jobTitle: string;
  jobDescription: string;
  company?: string;
}

// Job match response
export interface JobMatchResponse {
  id: string;
  resumeId: string;
  jobId: string;
  jobTitle: string;
  similarityScore: number;
  skillGaps: SkillGap;
  matchedSkills: string[];
  interviewQuestions: string[];
  recommendations: string[];
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Zod schemas for validation
export const JobMatchRequestSchema = z.object({
  resumeId: z.string().min(1, 'Resume ID is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  jobDescription: z.string().min(50, 'Job description must be at least 50 characters'),
  company: z.string().optional(),
});

export const ExtractedSkillsSchema = z.object({
  technicalSkills: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  yearsOfExperience: z.number().optional(),
  currentRole: z.string().optional(),
  education: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
});

// Vector metadata for Pinecone
export interface VectorMetadata {
  type: 'resume' | 'job';
  id: string;
  skills: string[];
  title?: string;
}

// Pinecone query result
export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}
