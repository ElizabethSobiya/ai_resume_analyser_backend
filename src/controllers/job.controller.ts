import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { aiService } from '../services/ai.service';
import { vectorService } from '../services/vector.service';
import {
  ApiResponse,
  JobMatchRequest,
  JobMatchResponse,
  JobMatchRequestSchema,
  ExtractedSkills,
} from '../types';

/**
 * Match a job description against a resume
 * POST /api/v1/jobs/match
 */
export async function matchJob(
  req: Request,
  res: Response<ApiResponse<JobMatchResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    // Validate request body
    const validationResult = JobMatchRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: {
          message: validationResult.error.errors[0].message,
        },
      });
      return;
    }

    const { resumeId, jobTitle, jobDescription, company } = validationResult.data;

    // Check if resume exists
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: { message: 'Resume not found' },
      });
      return;
    }

    console.log(`Matching job "${jobTitle}" against resume ${resumeId}`);

    // Extract skills from job description
    const jobSkills = await aiService.extractSkills(jobDescription);

    // Generate embedding for job description
    const jobEmbedding = await aiService.generateEmbedding(jobDescription);

    // Create job description record
    const job = await prisma.jobDescription.create({
      data: {
        title: jobTitle,
        company: company || null,
        description: jobDescription,
        requiredSkills: jobSkills as object,
      },
    });

    // Store job in vector database
    const allJobSkills = [
      ...jobSkills.technicalSkills,
      ...jobSkills.frameworks,
      ...jobSkills.tools,
    ];

    const jobVectorId = await vectorService.upsertJob(
      job.id,
      jobEmbedding,
      allJobSkills,
      jobTitle
    );

    // Update job with vector ID
    await prisma.jobDescription.update({
      where: { id: job.id },
      data: { vectorId: jobVectorId },
    });

    // Generate resume embedding for comparison
    const resumeEmbedding = await aiService.generateEmbedding(resume.rawText);

    // Find similar vectors to calculate similarity score
    const similarResults = await vectorService.findSimilar(resumeEmbedding, 10, 'job');
    const matchingResult = similarResults.find(r => r.id === jobVectorId);

    // Calculate similarity score
    const rawScore = matchingResult?.score || 0;
    const similarityScore = vectorService.calculateSimilarityPercentage(rawScore);

    // Analyze skill gaps
    const resumeSkills = resume.extractedSkills as unknown as ExtractedSkills;
    const skillGaps = await aiService.analyzeSkillGaps(resumeSkills, jobSkills);

    // Generate interview questions
    const interviewQuestions = await aiService.generateInterviewQuestions(
      skillGaps,
      jobTitle,
      skillGaps.matched
    );

    // Generate recommendations
    const recommendations = await aiService.generateRecommendations(skillGaps, jobTitle);

    // Save match to database
    const match = await prisma.jobMatch.upsert({
      where: {
        resumeId_jobId: {
          resumeId,
          jobId: job.id,
        },
      },
      update: {
        similarityScore,
        skillGaps: skillGaps as object,
        matchedSkills: skillGaps.matched,
        interviewQuestions,
        recommendations,
      },
      create: {
        resumeId,
        jobId: job.id,
        similarityScore,
        skillGaps: skillGaps as object,
        matchedSkills: skillGaps.matched,
        interviewQuestions,
        recommendations,
      },
    });

    console.log(`Match created: ${match.id} with score ${similarityScore}%`);

    res.status(201).json({
      success: true,
      data: {
        id: match.id,
        resumeId,
        jobId: job.id,
        jobTitle,
        similarityScore,
        skillGaps,
        matchedSkills: skillGaps.matched,
        interviewQuestions,
        recommendations,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all job descriptions
 * GET /api/v1/jobs
 */
export async function getJobs(
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.jobDescription.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          company: true,
          requiredSkills: true,
          createdAt: true,
          _count: {
            select: { matches: true },
          },
        },
      }),
      prisma.jobDescription.count(),
    ]);

    res.json({
      success: true,
      data: jobs.map(j => ({
        ...j,
        matchCount: j._count.matches,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get job matches for a specific job
 * GET /api/v1/jobs/:id/matches
 */
export async function getJobMatches(
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const job = await prisma.jobDescription.findUnique({
      where: { id },
      include: {
        matches: {
          include: {
            resume: {
              select: {
                id: true,
                fileName: true,
                extractedSkills: true,
              },
            },
          },
          orderBy: { similarityScore: 'desc' },
        },
      },
    });

    if (!job) {
      res.status(404).json({
        success: false,
        error: { message: 'Job not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: job.matches,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Find best matching resumes for a job description
 * POST /api/v1/jobs/find-candidates
 */
export async function findCandidates(
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { jobDescription, topK = 5 } = req.body;

    if (!jobDescription || typeof jobDescription !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'Job description is required' },
      });
      return;
    }

    // Generate embedding for job description
    const jobEmbedding = await aiService.generateEmbedding(jobDescription);

    // Find similar resumes
    const results = await vectorService.findSimilar(
      jobEmbedding,
      Math.min(topK, 20),
      'resume'
    );

    // Get resume details for each match
    const resumeIds = results.map(r => r.metadata.id);

    const resumes = await prisma.resume.findMany({
      where: { id: { in: resumeIds } },
      select: {
        id: true,
        fileName: true,
        extractedSkills: true,
        createdAt: true,
      },
    });

    // Combine with scores
    const candidates = results.map(result => {
      const resume = resumes.find(r => r.id === result.metadata.id);
      return {
        ...resume,
        similarityScore: vectorService.calculateSimilarityPercentage(result.score),
      };
    });

    res.json({
      success: true,
      data: candidates,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a job description
 * DELETE /api/v1/jobs/:id
 */
export async function deleteJob(
  req: Request,
  res: Response<ApiResponse<{ message: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const job = await prisma.jobDescription.findUnique({
      where: { id },
    });

    if (!job) {
      res.status(404).json({
        success: false,
        error: { message: 'Job not found' },
      });
      return;
    }

    // Delete from vector database
    if (job.vectorId) {
      await vectorService.deleteVector(job.vectorId);
    }

    // Delete from database (cascades to matches)
    await prisma.jobDescription.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: { message: 'Job deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}
