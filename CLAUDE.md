# Backend - Resume Analyzer API

## Tech Stack
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- OpenAI API (GPT-4o for skill extraction, text-embedding-3-small for vectors)
- Pinecone (vector similarity search)

## Important Rules
- ALWAYS read API keys from process.env
- NEVER hardcode API keys or secrets
- Use Zod for request validation
- Log all OpenAI API calls for debugging
- Handle errors gracefully with proper HTTP status codes

## Project Structure
```
src/
├── config/         # Database, OpenAI, Pinecone configuration
├── controllers/    # Request handlers
├── middleware/     # Error handling, logging
├── routes/         # API route definitions
├── services/       # Business logic (AI, parser, vector)
└── types/          # TypeScript interfaces
```

## Running Locally
```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## API Endpoints

### Resumes
- `POST /api/v1/resumes/upload` - Upload and analyze a resume
- `GET /api/v1/resumes` - Get all resumes
- `GET /api/v1/resumes/:id` - Get resume by ID
- `DELETE /api/v1/resumes/:id` - Delete a resume

### Jobs
- `POST /api/v1/jobs/match` - Match job description to resume
- `POST /api/v1/jobs/find-candidates` - Find matching resumes for a job
- `GET /api/v1/jobs` - Get all job descriptions
- `GET /api/v1/jobs/:id/matches` - Get matches for a job
- `DELETE /api/v1/jobs/:id` - Delete a job description

## Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX_NAME` - Pinecone index name

## Testing
```bash
# Health check
curl http://localhost:3001/health

# Upload resume
curl -X POST http://localhost:3001/api/v1/resumes/upload \
  -F "file=@resume.pdf"
```
