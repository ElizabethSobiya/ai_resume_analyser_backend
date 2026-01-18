import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { parserService } from '../services/parser.service';
import { aiService } from '../services/ai.service';
import { vectorService } from '../services/vector.service';
import { ApiResponse, ResumeUploadResponse, ExtractedSkills } from '../types';

/**
 * Upload and analyze a resume
 * POST /api/v1/resumes/upload
 */
export async function uploadResume(
  req: Request,
  res: Response<ApiResponse<ResumeUploadResponse>>,
  next: NextFunction
): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      success: false,
      error: { message: 'No file uploaded. Please upload a PDF or DOCX file.' },
    });
    return;
  }

  try {
    // Validate file
    parserService.validateFile(file);

    console.log(`Processing file: ${file.originalname}`);

    // Parse the file buffer and extract text
    const rawText = await parserService.parseBuffer(file.buffer, file.originalname);

    if (rawText.length < 100) {
      throw new Error('Resume content is too short. Please upload a complete resume.');
    }

    // Extract skills using AI
    const extractedSkills = await aiService.extractSkills(rawText);

    // Generate embedding for vector search
    const embedding = await aiService.generateEmbedding(rawText);

    // Save to database
    const resume = await prisma.resume.create({
      data: {
        fileName: file.originalname,
        rawText,
        extractedSkills: extractedSkills as object,
      },
    });

    // Store in vector database
    const allSkills = [
      ...extractedSkills.technicalSkills,
      ...extractedSkills.frameworks,
      ...extractedSkills.tools,
    ];

    const vectorId = await vectorService.upsertResume(
      resume.id,
      embedding,
      allSkills,
      extractedSkills.currentRole
    );

    // Update resume with vector ID
    await prisma.resume.update({
      where: { id: resume.id },
      data: { vectorId },
    });

    console.log(`Resume processed successfully: ${resume.id}`);

    res.status(201).json({
      success: true,
      data: {
        id: resume.id,
        fileName: resume.fileName,
        extractedSkills,
        vectorId,
        createdAt: resume.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all resumes
 * GET /api/v1/resumes
 */
export async function getResumes(
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;

    const [resumes, total] = await Promise.all([
      prisma.resume.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          extractedSkills: true,
          createdAt: true,
          _count: {
            select: { jobMatches: true },
          },
        },
      }),
      prisma.resume.count(),
    ]);

    res.json({
      success: true,
      data: resumes.map(r => ({
        ...r,
        matchCount: r._count.jobMatches,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single resume by ID
 * GET /api/v1/resumes/:id
 */
export async function getResumeById(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const resume = await prisma.resume.findUnique({
      where: { id },
      include: {
        jobMatches: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                company: true,
              },
            },
          },
          orderBy: { similarityScore: 'desc' },
        },
      },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: { message: 'Resume not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: resume,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a resume
 * DELETE /api/v1/resumes/:id
 */
export async function deleteResume(
  req: Request,
  res: Response<ApiResponse<{ message: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const resume = await prisma.resume.findUnique({
      where: { id },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: { message: 'Resume not found' },
      });
      return;
    }

    // Delete from vector database
    if (resume.vectorId) {
      await vectorService.deleteVector(resume.vectorId);
    }

    // Delete from database (cascades to job matches)
    await prisma.resume.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: { message: 'Resume deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}
