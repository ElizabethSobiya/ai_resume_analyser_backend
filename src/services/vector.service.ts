import { pinecone, INDEX_NAME, EMBEDDING_DIMENSION } from '../config/pinecone';
import type { VectorQueryResult } from '../types';
import type { RecordMetadata } from '@pinecone-database/pinecone';

export class VectorService {
  private indexInitialized = false;

  /**
   * Initialize or get the Pinecone index
   */
  async initializeIndex(): Promise<void> {
    if (this.indexInitialized) {
      return;
    }

    try {
      const indexList = await pinecone.listIndexes();
      const indexExists = indexList.indexes?.some((idx: { name: string }) => idx.name === INDEX_NAME);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${INDEX_NAME}`);
        await pinecone.createIndex({
          name: INDEX_NAME,
          dimension: EMBEDDING_DIMENSION,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        // Wait for index to be ready
        console.log('Waiting for index to be ready...');
        await this.waitForIndexReady();
      }

      this.indexInitialized = true;
      console.log(`Pinecone index ${INDEX_NAME} is ready`);
    } catch (error) {
      console.error('Error initializing Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Wait for index to become ready
   */
  private async waitForIndexReady(maxWaitMs = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const description = await pinecone.describeIndex(INDEX_NAME);
        if (description.status?.ready) {
          return;
        }
      } catch {
        // Index might not be queryable yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Timeout waiting for Pinecone index to be ready');
  }

  /**
   * Get the Pinecone index
   */
  private getIndex() {
    return pinecone.index(INDEX_NAME);
  }

  /**
   * Store a resume embedding in Pinecone
   */
  async upsertResume(
    id: string,
    embedding: number[],
    skills: string[],
    title?: string
  ): Promise<string> {
    await this.initializeIndex();

    const vectorId = `resume_${id}`;
    const metadata: RecordMetadata = {
      type: 'resume',
      id,
      skills,
      title: title || '',
    };

    try {
      const index = this.getIndex();
      await index.upsert([
        {
          id: vectorId,
          values: embedding,
          metadata,
        },
      ]);

      console.log(`Upserted resume vector: ${vectorId}`);
      return vectorId;
    } catch (error) {
      console.error('Error upserting resume vector:', error);
      throw new Error('Failed to store resume in vector database');
    }
  }

  /**
   * Store a job description embedding in Pinecone
   */
  async upsertJob(
    id: string,
    embedding: number[],
    skills: string[],
    title: string
  ): Promise<string> {
    await this.initializeIndex();

    const vectorId = `job_${id}`;
    const metadata: RecordMetadata = {
      type: 'job',
      id,
      skills,
      title,
    };

    try {
      const index = this.getIndex();
      await index.upsert([
        {
          id: vectorId,
          values: embedding,
          metadata,
        },
      ]);

      console.log(`Upserted job vector: ${vectorId}`);
      return vectorId;
    } catch (error) {
      console.error('Error upserting job vector:', error);
      throw new Error('Failed to store job in vector database');
    }
  }

  /**
   * Find similar vectors (resumes or jobs)
   */
  async findSimilar(
    embedding: number[],
    topK: number = 5,
    filterType?: 'resume' | 'job'
  ): Promise<VectorQueryResult[]> {
    await this.initializeIndex();

    try {
      const index = this.getIndex();

      const queryOptions: {
        vector: number[];
        topK: number;
        includeMetadata: boolean;
        filter?: { type: string };
      } = {
        vector: embedding,
        topK,
        includeMetadata: true,
      };

      if (filterType) {
        queryOptions.filter = { type: filterType };
      }

      const results = await index.query(queryOptions);

      return (results.matches || []).map(match => {
        const metadata = match.metadata;
        return {
          id: match.id,
          score: match.score || 0,
          metadata: {
            type: (metadata?.type as string) as 'resume' | 'job' || 'resume',
            id: (metadata?.id as string) || match.id,
            skills: (metadata?.skills as string[]) || [],
            title: metadata?.title as string | undefined,
          },
        };
      });
    } catch (error) {
      console.error('Error querying similar vectors:', error);
      throw new Error('Failed to search vector database');
    }
  }

  /**
   * Calculate similarity percentage from cosine similarity score
   */
  calculateSimilarityPercentage(score: number): number {
    // Cosine similarity ranges from -1 to 1
    // Convert to 0-100 percentage
    const percentage = ((score + 1) / 2) * 100;
    return Math.round(percentage * 10) / 10; // Round to 1 decimal
  }

  /**
   * Delete a vector by ID
   */
  async deleteVector(vectorId: string): Promise<void> {
    await this.initializeIndex();

    try {
      const index = this.getIndex();
      await index.deleteOne(vectorId);
      console.log(`Deleted vector: ${vectorId}`);
    } catch (error) {
      console.error('Error deleting vector:', error);
    }
  }

  /**
   * Delete all vectors for a resume
   */
  async deleteResumeVector(resumeId: string): Promise<void> {
    await this.deleteVector(`resume_${resumeId}`);
  }

  /**
   * Delete all vectors for a job
   */
  async deleteJobVector(jobId: string): Promise<void> {
    await this.deleteVector(`job_${jobId}`);
  }
}

export const vectorService = new VectorService();
