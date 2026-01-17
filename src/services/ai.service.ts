import { openai, OPENAI_MODEL, EMBEDDING_MODEL } from '../config/openai';
import { ExtractedSkills, SkillGap, ExtractedSkillsSchema } from '../types';

export class AIService {
  /**
   * Extract skills from resume text using GPT-4o
   */
  async extractSkills(text: string): Promise<ExtractedSkills> {
    const prompt = `Analyze this resume and extract skills. Return ONLY valid JSON matching this exact structure:

{
  "technicalSkills": ["skill1", "skill2"],
  "frameworks": ["React", "Node.js", "Express"],
  "languages": ["English", "Spanish"],
  "tools": ["Git", "Docker", "AWS"],
  "softSkills": ["Leadership", "Communication"],
  "yearsOfExperience": 5,
  "currentRole": "Senior Software Engineer",
  "education": ["BS Computer Science"],
  "certifications": ["AWS Certified"]
}

Rules:
- technicalSkills: Programming languages, databases, cloud platforms
- frameworks: Libraries and frameworks (React, Angular, Django, etc.)
- languages: Spoken/written languages
- tools: Development tools, CI/CD, IDEs
- softSkills: Non-technical skills
- yearsOfExperience: Total years (number or null)
- currentRole: Most recent job title
- education: Degrees and institutions
- certifications: Professional certifications

Resume text:
${text.substring(0, 8000)}`;

    try {
      console.log('Calling OpenAI to extract skills...');

      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR analyst. Extract skills from resumes accurately. Always respond with valid JSON only, no markdown or explanation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const validated = ExtractedSkillsSchema.parse(parsed);

      console.log('Skills extracted successfully');
      return validated;
    } catch (error) {
      console.error('Error extracting skills:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to extract skills: ${error.message}`);
      }
      throw new Error('Failed to extract skills from resume');
    }
  }

  /**
   * Generate embedding vector for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text if too long for embedding model
      const truncatedText = text.substring(0, 8000);

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedText,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Analyze skill gaps between resume and job requirements
   */
  async analyzeSkillGaps(
    resumeSkills: ExtractedSkills,
    jobSkills: ExtractedSkills
  ): Promise<SkillGap> {
    // Combine all skills into sets for comparison
    const resumeAllSkills = new Set([
      ...resumeSkills.technicalSkills,
      ...resumeSkills.frameworks,
      ...resumeSkills.tools,
    ].map(s => s.toLowerCase()));

    const jobAllSkills = [
      ...jobSkills.technicalSkills,
      ...jobSkills.frameworks,
      ...jobSkills.tools,
    ];

    const matched: string[] = [];
    const missing: string[] = [];
    const partial: string[] = [];

    for (const skill of jobAllSkills) {
      const skillLower = skill.toLowerCase();

      if (resumeAllSkills.has(skillLower)) {
        matched.push(skill);
      } else {
        // Check for partial matches (e.g., "React" matches "React.js")
        const hasPartialMatch = Array.from(resumeAllSkills).some(
          rs => rs.includes(skillLower) || skillLower.includes(rs)
        );

        if (hasPartialMatch) {
          partial.push(skill);
        } else {
          missing.push(skill);
        }
      }
    }

    return { matched, missing, partial };
  }

  /**
   * Generate interview questions based on skill gaps
   */
  async generateInterviewQuestions(
    skillGaps: SkillGap,
    jobTitle: string,
    matchedSkills: string[]
  ): Promise<string[]> {
    const prompt = `Generate 5-7 interview questions for a ${jobTitle} position.

Context:
- Candidate's matched skills: ${matchedSkills.join(', ')}
- Skills needing assessment (gaps): ${skillGaps.missing.join(', ')}
- Partially matched skills: ${skillGaps.partial.join(', ')}

Generate questions that:
1. Assess depth of knowledge in matched skills
2. Explore learning ability for missing skills
3. Include behavioral questions about soft skills
4. Mix technical and situational questions

Return ONLY a JSON array of question strings, like:
["Question 1?", "Question 2?", "Question 3?"]`;

    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical interviewer. Generate insightful interview questions. Respond with a JSON array only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.getDefaultQuestions(jobTitle);
      }

      const parsed = JSON.parse(content);
      // Handle both array response and object with questions property
      const questions = Array.isArray(parsed) ? parsed : parsed.questions;

      if (!Array.isArray(questions)) {
        return this.getDefaultQuestions(jobTitle);
      }

      return questions.slice(0, 7);
    } catch (error) {
      console.error('Error generating interview questions:', error);
      return this.getDefaultQuestions(jobTitle);
    }
  }

  /**
   * Generate recommendations for the candidate
   */
  async generateRecommendations(
    skillGaps: SkillGap,
    jobTitle: string
  ): Promise<string[]> {
    if (skillGaps.missing.length === 0 && skillGaps.partial.length === 0) {
      return ['Great match! Your skills align well with this position.'];
    }

    const prompt = `Provide 3-5 actionable recommendations for a candidate applying to a ${jobTitle} position.

Missing skills: ${skillGaps.missing.join(', ')}
Partial skills (need improvement): ${skillGaps.partial.join(', ')}

Recommendations should:
1. Suggest specific courses or certifications
2. Recommend practical projects to build skills
3. Provide resources for learning
4. Be actionable and realistic

Return ONLY a JSON array of recommendation strings.`;

    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a career coach. Provide helpful, actionable recommendations. Respond with a JSON array only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.getDefaultRecommendations(skillGaps.missing);
      }

      const parsed = JSON.parse(content);
      const recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations;

      if (!Array.isArray(recommendations)) {
        return this.getDefaultRecommendations(skillGaps.missing);
      }

      return recommendations.slice(0, 5);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return this.getDefaultRecommendations(skillGaps.missing);
    }
  }

  private getDefaultQuestions(jobTitle: string): string[] {
    return [
      `Tell me about your experience relevant to this ${jobTitle} role.`,
      'Describe a challenging project you worked on and how you overcame obstacles.',
      'How do you stay updated with the latest technologies in your field?',
      'Can you walk me through your problem-solving process?',
      'Where do you see yourself in 5 years?',
    ];
  }

  private getDefaultRecommendations(missingSkills: string[]): string[] {
    const recommendations = [
      'Consider taking online courses to strengthen your technical skills.',
      'Build side projects to gain practical experience.',
      'Contribute to open-source projects in your area of interest.',
    ];

    if (missingSkills.length > 0) {
      recommendations.unshift(
        `Focus on learning: ${missingSkills.slice(0, 3).join(', ')}`
      );
    }

    return recommendations;
  }
}

export const aiService = new AIService();
