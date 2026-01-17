import express from 'express';
import {
  matchJob,
  getJobs,
  getJobMatches,
  findCandidates,
  deleteJob,
} from '../controllers/job.controller';

const router = express.Router();

/**
 * @route   POST /api/v1/jobs/match
 * @desc    Match a job description against a resume
 * @access  Public
 */
router.post('/match', matchJob);

/**
 * @route   POST /api/v1/jobs/find-candidates
 * @desc    Find best matching resumes for a job description
 * @access  Public
 */
router.post('/find-candidates', findCandidates);

/**
 * @route   GET /api/v1/jobs
 * @desc    Get all job descriptions
 * @access  Public
 */
router.get('/', getJobs);

/**
 * @route   GET /api/v1/jobs/:id/matches
 * @desc    Get all matches for a job
 * @access  Public
 */
router.get('/:id/matches', getJobMatches);

/**
 * @route   DELETE /api/v1/jobs/:id
 * @desc    Delete a job description
 * @access  Public
 */
router.delete('/:id', deleteJob);

export default router;
