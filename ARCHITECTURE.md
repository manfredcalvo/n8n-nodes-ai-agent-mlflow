# Architecture Documentation

## Overview

This n8n community node integrates AI Agents powered by LangChain with MLflow observability via Databricks. It provides production-grade tracing, security, and monitoring capabilities for AI agent workflows.

## Core Components

### 1. Execution Layer (`nodes/AgentWithMLFlow/V2/execute.ts`)

**Responsibilities:**
- Main execution orchestration
- MLflow integration and lifecycle management
- Batch processing with cancellation support
- Rate limiting per Databricks credential
- Comprehensive error handling and cleanup

**Key Features:**
- **Rate Limiting**: 100 requests/minute per credential to prevent API abuse
- **Cleanup**: Ensures all MLflow handlers are properly disposed in finally block
- **Cancellation**: Respects n8n execution cancellation signals
- **Security**: All credentials masked in logs, comprehensive input validation

**Flow:**
```
1. Load & validate credentials
2. Initialize MLflow client + rate limiter
3. Get or create experiment (with validation)
4. Create agent executor with tools
5. Process items in batches
6. Stream events and track with MLflow
7. Cleanup resources (guaranteed via finally)
```

### 2. MLflow Callback Handler (`nodes/AgentWithMLFlow/V2/CallbackHandler.ts`)

**Responsibilities:**
- LangChain event tracking to MLflow spans
- Memory leak prevention via bounded span map
- Automatic cleanup of orphaned spans

**Key Features:**
- **Memory Management**: Max 1000 spans with automatic cleanup
- **Event Handling**: Tracks LLM calls, tool usage, agent steps, errors
- **Cleanup**: Public cleanup() method + automatic old span removal

**Span Types:**
- `AGENT`: Top-level agent execution
- `TOOL`: Tool invocations
- `CHAT_MODEL`: LLM calls
- `RETRIEVER`: Vector store queries

### 3. Security Layer (`nodes/AgentWithMLFlow/src/utils/security.ts`)

**Responsibilities:**
- Input validation and sanitization
- SSRF and path traversal protection
- Rate limiting infrastructure
- API response validation

**Protections:**
- **Path Traversal**: Validates experiment names against `../` patterns
- **SSRF**: Whitelists Databricks domains, blocks private IPs
- **Injection**: Sanitizes experiment IDs to numeric-only
- **DoS**: Length limits on all string inputs
- **Response Validation**: Checks API responses before use

### 4. Retry Logic (`nodes/AgentWithMLFlow/src/utils/retry.ts`)

**Responsibilities:**
- Exponential backoff with jitter
- Smart error classification (retryable vs not)
- Token masking for safe logging

**Retry Strategy:**
- Base delay: 1000ms
- Exponential backoff: delay * 2^attempt
- Max delay: 10000ms
- Jitter: 50-100% of calculated delay

**Retryable Errors:**
- 429 (Rate Limit), 500, 502, 503, 504
- Network timeouts, ECONNRESET, ECONNREFUSED

**Non-Retryable:**
- 400, 401, 403, 404 (client errors)
- Authentication/permission errors

### 5. Constants (`nodes/AgentWithMLFlow/src/constants.ts`)

**Purpose:**
- Centralized configuration
- Security patterns (regex)
- Error messages
- Magic numbers elimination

**Categories:**
- MLflow timeouts and limits
- Security validation patterns
- Error message templates
- Token masking patterns
- HTTP status code lists

## Data Flow

```
User Input
    ↓
[Input Validation] → Experiment name, IDs, batch params
    ↓
[Credential Validation] → Host URL (SSRF check), Token (length check)
    ↓
[Rate Limiting] → Check requests/minute limit
    ↓
[MLflow Setup] → Get/create experiment, initialize client
    ↓
[Agent Execution] → Process items with LangChain
    ↓
[Event Streaming] → Track spans in MLflow via CallbackHandler
    ↓
[Result Processing] → Parse outputs, handle errors
    ↓
[Cleanup] → Close spans, dispose handlers
    ↓
Output
```

## Security Architecture

### Defense in Depth

**Layer 1: Input Validation**
- All user inputs validated before use
- Type checking + format validation
- Length limits to prevent DoS

**Layer 2: Sanitization**
- Experiment names: Remove traversal patterns, normalize slashes
- Experiment IDs: Numeric-only enforcement
- URLs: Protocol + domain validation

**Layer 3: Output Filtering**
- All logs pass through `maskTokensInText()`
- Credentials masked: `dapi****`, `https://adb-12345.***`
- Stack traces sanitized

**Layer 4: Rate Limiting**
- Per-credential rate limiters
- Sliding window algorithm
- Prevents API abuse and quota exhaustion

**Layer 5: API Response Validation**
- Structure validation before data use
- Required field checks
- Prevents malicious responses

### Threat Model

| Threat | Mitigation | Location |
|--------|------------|----------|
| Path Traversal | Regex validation + sanitization | `security.ts:30-77` |
| SSRF | Domain whitelist + private IP blocking | `security.ts:91-155` |
| SQL/NoSQL Injection | Numeric-only IDs, no string concat | `security.ts:172-184` |
| Credential Leakage | Token masking in logs/errors | `retry.ts:253-298` |
| DoS via Input | Length limits on all inputs | `constants.ts:172-174` |
| API Abuse | Rate limiting (100 req/min) | `execute.ts:50-63` |
| Memory Leaks | Bounded collections + cleanup | `CallbackHandler.ts:88-108` |

## Testing Strategy

### Unit Tests

**Coverage Target: 80%+**

Test suites:
- `security.test.ts`: 35 tests covering all validation functions
- `retry.test.ts`: 8 tests covering token masking

**Test Categories:**
1. **Happy Path**: Valid inputs return expected results
2. **Malicious Inputs**: Path traversal, injection attempts rejected
3. **Edge Cases**: Empty strings, null, undefined handled
4. **Boundary Conditions**: Length limits, rate limits enforced

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Performance Considerations

### Memory Management

1. **CallbackHandler**:
   - Max 1000 spans in runMap
   - Automatic cleanup at 500 spans
   - WeakMap considered for future optimization

2. **Rate Limiters**:
   - Per-credential instances (not per execution)
   - Sliding window with automatic old entry cleanup

3. **Batch Processing**:
   - Configurable batch size (max 1000)
   - Configurable delay between batches (max 5min)
   - Cancellation checks between batches

### API Efficiency

1. **Retry Logic**:
   - Exponential backoff prevents thundering herd
   - Jitter prevents synchronized retries
   - Smart error classification avoids unnecessary retries

2. **Rate Limiting**:
   - Prevents hitting Databricks API limits
   - Shared across executions for same credential
   - Configurable window and limit

## Error Handling

### Error Hierarchy

```
NodeOperationError (n8n standard)
  ├─ Validation Errors (400-level)
  │  ├─ Empty/invalid inputs
  │  ├─ Failed security checks
  │  └─ Rate limit exceeded
  ├─ Authentication Errors (401/403)
  │  ├─ Invalid credentials
  │  └─ Insufficient permissions
  └─ Execution Errors (500-level)
     ├─ MLflow initialization failed
     ├─ Agent execution failed
     └─ Network/timeout errors
```

### Error Messages

- **User-friendly**: Clear actionable messages
- **Contextual**: Include relevant details (batch number, experiment name)
- **Secure**: All tokens masked via `maskTokensInText()`
- **Structured**: Consistent format across the codebase

## Extending the Node

### Adding New Validations

1. Add pattern to `constants.ts` → `SECURITY_PATTERNS`
2. Create validation function in `security.ts`
3. Add tests in `security.test.ts`
4. Apply in `execute.ts` before API calls

### Adding New MLflow Span Types

1. Add new span type to CallbackHandler event handlers
2. Map LangChain event to MLflow span
3. Set appropriate span attributes
4. Test with actual LangChain execution

### Modifying Rate Limits

1. Update `getRateLimiter()` parameters in `execute.ts:60`
2. Consider adding user-configurable rate limits as node parameter
3. Document in README

## Deployment

### Build Process

```bash
npm run build        # TypeScript compile + icons
npm pack            # Create tarball
```

### Docker Deployment

```bash
# Build image
cd docker && docker build -t n8n-mlflow:latest .

# Run container
docker run -p 5678:5678 n8n-mlflow:latest
```

### Production Checklist

- [ ] All tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Rate limits configured appropriately
- [ ] Databricks credentials secured
- [ ] Monitoring/logging configured
- [ ] Resource cleanup verified

## Monitoring

### Metrics to Track

1. **Performance**:
   - Average execution time per item
   - Batch processing time
   - API response times

2. **Errors**:
   - Error rate by type
   - Retry counts
   - Rate limit hits

3. **Resources**:
   - Span map size (CallbackHandler)
   - Rate limiter queue depth
   - Memory usage

### Logging Levels

- `debug`: Internal state, masked credentials, retry attempts
- `info`: Execution milestones, experiment creation
- `warn`: Degraded performance, approaching limits
- `error`: Failures, exceptions

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style and formatting
- Testing requirements
- PR process
- Security guidelines

## License

MIT - See [LICENSE](LICENSE) file
