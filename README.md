# Resume Analyzer Backend

AI-powered resume analyzer backend API built with Node.js, Express, and TypeScript.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **AI**: OpenAI GPT-4o
- **Vector Search**: Pinecone
- **File Parsing**: pdf-parse, mammoth

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- OpenAI API key
- Pinecone API key

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys
   ```

3. **Start PostgreSQL database**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## API Endpoints

### Health Check
- `GET /health` - Check API status

### Resumes
- `POST /api/v1/resumes/upload` - Upload and analyze a resume (PDF/DOCX)
- `GET /api/v1/resumes` - List all resumes
- `GET /api/v1/resumes/:id` - Get resume details

### Jobs
- `POST /api/v1/jobs/match` - Match a job description against resumes
- `GET /api/v1/jobs` - List all job descriptions
- `GET /api/v1/jobs/:id/matches` - Get matches for a job

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | OpenAI model to use (default: gpt-4o) |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Pinecone index name |
| `ALLOWED_ORIGINS` | CORS allowed origins |

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## License

MIT
