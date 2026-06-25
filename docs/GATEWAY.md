# API Gateway Quick Start

## Overview

The API Gateway provides enterprise-grade HTTP access to Nexus Agent with:

- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - Token bucket algorithm (per-user)
- **CORS Support** - Configurable origins
- **RESTful API** - Learning, Chat, Skills, Workflow endpoints
- **Health & Metrics** - Monitoring endpoints

## Quick Start

### 1. Configuration

Edit `config/gateway.json`:

```json
{
  "port": 8080,
  "host": "0.0.0.0",
  "auth": {
    "jwtSecret": "your-secret-key-at-least-32-characters-long-change-in-production",
    "publicPaths": ["/health", "/metrics", "/api/auth/login"]
  },
  "rateLimit": {
    "maxTokens": 100,
    "refillRate": 10
  }
}
```

**Important**: Change `jwtSecret` in production!

### 2. Start Gateway

```bash
npm run start:gateway
```

Gateway will start on `http://localhost:8080`

### 3. Test Health Check

```bash
curl http://localhost:8080/health
```

## API Endpoints

### Public Endpoints (No Auth Required)

- `GET /health` - Health check
- `GET /metrics` - Gateway statistics

### Protected Endpoints (Require JWT)

#### Chat API
- `POST /api/chat` - Send message to AI

#### Skills API
- `GET /api/skills` - List all available skills
- `GET /api/skills/:id` - Get specific skill details

#### Learning API
- `POST /api/learning/feedback` - Submit user feedback
- `GET /api/learning/stats` - Get learning statistics
- `GET /api/learning/report?days=7` - Generate learning report
- `GET /api/learning/suggestions` - Get improvement suggestions
- `GET /api/learning/skills/stats` - Get skill usage stats
- `GET /api/learning/satisfaction?days=7` - Get satisfaction metrics

#### Workflow API (Coming Soon)
- `GET /api/workflow` - Workflow management

## Authentication

### Generating JWT Tokens

For development/testing, you can generate tokens using:

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    userId: 'user-123',
    role: 'user',
    permissions: ['chat', 'read:skills', 'write:feedback']
  },
  'your-secret-key-at-least-32-characters-long-change-in-production',
  { expiresIn: '1h' }
);

console.log(token);
```

### Using Tokens

Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/chat \
  -d '{"message": "Hello!"}'
```

## Demo Client

Run the interactive demo:

```bash
npm run gateway:demo
```

This will run all demo scenarios including:
- Basic health checks
- Chat API
- Skills API
- Learning API
- Rate limiting
- Error handling

## Rate Limiting

- **Authenticated users**: 1 token per request
- **Unauthenticated users**: 10 tokens per request
- **Bucket capacity**: 100 tokens (configurable)
- **Refill rate**: 10 tokens/second (configurable)

Rate limit info is returned in response headers:
- `X-RateLimit-Remaining` - Tokens remaining

## Environment Variables

Optional environment variables:

```bash
# JWT Secret (overrides config file)
export JWT_SECRET="your-secret-key"

# Default AI Model
export DEFAULT_MODEL="claude-sonnet-4-20250514"

# Default Provider
export DEFAULT_PROVIDER="claude"

# Data Directory
export DATA_DIR="./data"

# Enable Learning
export ENABLE_LEARNING="true"
```

## Examples

### Send Chat Message

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the weather like?",
    "sessionId": "optional-session-id"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "I don't have access to real-time weather data...",
    "sessionId": "abc-123",
    "timestamp": 1234567890
  }
}
```

### Submit Feedback

```bash
curl -X POST http://localhost:8080/api/learning/feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123",
    "messageId": "msg-456",
    "rating": 5,
    "comment": "Great response!"
  }'
```

### Get Learning Stats

```bash
curl http://localhost:8080/api/learning/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security Notes

1. **Always use HTTPS in production**
2. **Change the JWT secret** before deploying
3. **Use strong secrets** (min 32 chars, high entropy)
4. **Configure CORS** for your specific origins
5. **Monitor rate limits** to detect abuse
6. **Rotate JWT secrets** periodically

## Monitoring

Check gateway metrics:

```bash
curl http://localhost:8080/metrics
```

Returns:
```json
{
  "success": true,
  "data": {
    "uptime": 123456,
    "totalRequests": 1000,
    "activeConnections": 5,
    "rateLimiterStats": {
      "totalBuckets": 10,
      "config": {
        "maxTokens": 100,
        "refillRate": 10
      }
    }
  }
}
```

## Troubleshooting

### Port Already in Use

Change the port in `config/gateway.json` or set `PORT` env var.

### JWT Secret Too Short

Error: "JWT secret must be at least 32 characters"

Solution: Use a longer, more random secret.

### Connection Refused

Make sure the gateway is running:
```bash
npm run start:gateway
```

### Rate Limited

Wait for tokens to refill or increase limits in config.

## Next Steps

- Integrate with your frontend application
- Set up production JWT authentication service
- Configure monitoring and alerting
- Add custom middleware for your use case
- Implement additional API endpoints
