import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  uploadResume,
  getResumes,
  getResumeById,
  deleteResume,
} from '../controllers/resume.controller';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `resume-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * @route   POST /api/v1/resumes/upload
 * @desc    Upload and analyze a resume
 * @access  Public
 */
router.post('/upload', upload.single('file'), uploadResume);

/**
 * @route   GET /api/v1/resumes
 * @desc    Get all resumes
 * @access  Public
 */
router.get('/', getResumes);

/**
 * @route   GET /api/v1/resumes/:id
 * @desc    Get a single resume by ID
 * @access  Public
 */
router.get('/:id', getResumeById);

/**
 * @route   DELETE /api/v1/resumes/:id
 * @desc    Delete a resume
 * @access  Public
 */
router.delete('/:id', deleteResume);

export default router;
