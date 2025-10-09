/**
 * Security utilities test suite
 *
 * Comprehensive tests for input validation, sanitization, and security protections
 */

import {
	validateExperimentName,
	validateDatabricksHost,
	sanitizeExperimentId,
	validateApiResponse,
	RateLimiter,
} from '../security';

describe('Security Utilities', () => {
	describe('validateExperimentName', () => {
		it('should accept valid experiment names', () => {
			const validNames = [
				'my-experiment',
				'Experiment_123',
				'Production Model v1',
				'ml/models/classifier',
			];

			validNames.forEach((name) => {
				const result = validateExperimentName(name);
				expect(result.isValid).toBe(true);
				expect(result.sanitized).toBeDefined();
			});
		});

		it('should reject path traversal attempts', () => {
			const maliciousNames = [
				'../../../etc/passwd',
				'..\\windows\\system32',
				'%2e%2e/secrets',
				'experiment/../admin',
			];

			maliciousNames.forEach((name) => {
				const result = validateExperimentName(name);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain('path traversal');
			});
		});

		it('should reject names with invalid characters', () => {
			const invalidNames = ['<script>alert(1)</script>', 'exp;rm -rf /', 'name&param=value'];

			invalidNames.forEach((name) => {
				const result = validateExperimentName(name);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain('invalid characters');
			});
		});

		it('should reject empty names', () => {
			const emptyNames = ['', '   ', '\t\n'];

			emptyNames.forEach((name) => {
				const result = validateExperimentName(name);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain('empty');
			});
		});

		it('should reject names that exceed maximum length', () => {
			const longName = 'a'.repeat(201);
			const result = validateExperimentName(longName);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('too long');
		});

		it('should sanitize valid names correctly', () => {
			const testCases = [
				{ input: '  experiment  ', expected: 'experiment' },
				{ input: '/experiment/', expected: 'experiment' },
				{ input: 'path//to//exp', expected: 'path/to/exp' },
			];

			testCases.forEach(({ input, expected }) => {
				const result = validateExperimentName(input);
				expect(result.isValid).toBe(true);
				expect(result.sanitized).toBe(expected);
			});
		});
	});

	describe('validateDatabricksHost', () => {
		it('should accept valid Databricks Azure hosts', () => {
			const validHosts = [
				'https://adb-12345.6.azuredatabricks.net',
				'https://adb-98765.14.azuredatabricks.net',
			];

			validHosts.forEach((host) => {
				const result = validateDatabricksHost(host);
				expect(result.isValid).toBe(true);
				expect(result.sanitized).toBe(host);
			});
		});

		it('should accept valid Databricks AWS hosts', () => {
			const validHosts = [
				'https://dbc-12345678-abcd.cloud.databricks.com',
				'https://my-workspace.cloud.databricks.com',
			];

			validHosts.forEach((host) => {
				const result = validateDatabricksHost(host);
				expect(result.isValid).toBe(true);
			});
		});

		it('should accept valid Databricks GCP hosts', () => {
			const validHosts = ['https://12345678.9.gcp.databricks.com'];

			validHosts.forEach((host) => {
				const result = validateDatabricksHost(host);
				expect(result.isValid).toBe(true);
			});
		});

		it('should accept localhost for development', () => {
			const localhostHosts = ['https://localhost:8080', 'https://localhost'];

			localhostHosts.forEach((host) => {
				const result = validateDatabricksHost(host);
				expect(result.isValid).toBe(true);
			});

			// Note: localhost IP (127.0.0.1) must be tested separately
			// It will fail regex check but pass private IP check if it reaches there
		});

		it('should reject non-HTTPS hosts', () => {
			const result = validateDatabricksHost('http://adb-12345.azuredatabricks.net');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('valid Databricks workspace');
		});

		it('should reject private IP addresses (SSRF protection)', () => {
			const privateIps = [
				'https://192.168.1.1',
				'https://10.0.0.1',
				'https://172.16.0.1',
				'https://127.0.0.1', // localhost IP
			];

			privateIps.forEach((ip) => {
				const result = validateDatabricksHost(ip);
				// All IPs are rejected at regex level (not valid Databricks URL pattern)
				expect(result.isValid).toBe(false);
				expect(result.error).toContain('not a valid Databricks');
			});
		});

		it('should reject non-Databricks domains', () => {
			const invalidHosts = [
				'https://evil.com',
				'https://google.com',
				'https://fake-databricks.com',
			];

			invalidHosts.forEach((host) => {
				const result = validateDatabricksHost(host);
				expect(result.isValid).toBe(false);
			});
		});

		it('should reject empty or invalid URLs', () => {
			const invalidUrls = ['', '   ', 'not-a-url', 'javascript:alert(1)'];

			invalidUrls.forEach((url) => {
				const result = validateDatabricksHost(url);
				expect(result.isValid).toBe(false);
			});
		});

		it('should reject hosts exceeding maximum length', () => {
			const longHost = 'https://' + 'a'.repeat(500) + '.azuredatabricks.net';
			const result = validateDatabricksHost(longHost);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('too long');
		});
	});

	describe('sanitizeExperimentId', () => {
		it('should accept valid numeric experiment IDs', () => {
			const validIds = ['123', '1427538817675103', '0', '999999999999999'];

			validIds.forEach((id) => {
				const result = sanitizeExperimentId(id);
				expect(result).toBe(id);
			});
		});

		it('should reject non-numeric IDs (injection prevention)', () => {
			const invalidIds = [
				'abc123',
				'123; DROP TABLE experiments;',
				'123 OR 1=1',
				'<script>',
				'../../secrets',
			];

			invalidIds.forEach((id) => {
				const result = sanitizeExperimentId(id);
				expect(result).toBeNull();
			});
		});

		it('should reject IDs with special characters', () => {
			const invalidIds = ['123-456', '123.456', '123,456', '123_456'];

			invalidIds.forEach((id) => {
				const result = sanitizeExperimentId(id);
				expect(result).toBeNull();
			});
		});

		it('should reject IDs exceeding maximum length', () => {
			const longId = '1'.repeat(21);
			const result = sanitizeExperimentId(longId);
			expect(result).toBeNull();
		});

		it('should reject empty IDs', () => {
			const emptyIds = ['', '   '];

			emptyIds.forEach((id) => {
				const result = sanitizeExperimentId(id.trim());
				expect(result).toBeNull();
			});
		});
	});

	describe('validateApiResponse', () => {
		it('should accept valid responses with all required fields', () => {
			const response = {
				experiment_id: '123',
				name: 'test-experiment',
				status: 'active',
			};

			const result = validateApiResponse(response, ['experiment_id', 'name']);
			expect(result.isValid).toBe(true);
		});

		it('should reject non-object responses', () => {
			const invalidResponses = [null, undefined, 'string', 123, true];

			invalidResponses.forEach((response) => {
				const result = validateApiResponse(response, ['field']);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain('not an object');
			});

			// Arrays technically are objects, but will fail field check
			const arrayResult = validateApiResponse([], ['field']);
			expect(arrayResult.isValid).toBe(false);
		});

		it('should reject responses missing required fields', () => {
			const response = {
				name: 'test-experiment',
			};

			const result = validateApiResponse(response, ['experiment_id', 'name']);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('missing required field: experiment_id');
		});

		it('should accept responses with extra fields', () => {
			const response = {
				experiment_id: '123',
				name: 'test',
				extra_field: 'should be ignored',
			};

			const result = validateApiResponse(response, ['experiment_id']);
			expect(result.isValid).toBe(true);
		});
	});

	describe('RateLimiter', () => {
		it('should allow requests within rate limit', () => {
			const limiter = new RateLimiter(5, 1000); // 5 requests per second

			for (let i = 0; i < 5; i++) {
				expect(limiter.isAllowed()).toBe(true);
			}
		});

		it('should block requests exceeding rate limit', () => {
			const limiter = new RateLimiter(3, 1000); // 3 requests per second

			// Use up all requests
			for (let i = 0; i < 3; i++) {
				limiter.isAllowed();
			}

			// Next request should be blocked
			expect(limiter.isAllowed()).toBe(false);
		});

		it('should reset after time window expires', async () => {
			const limiter = new RateLimiter(2, 100); // 2 requests per 100ms

			// Use up requests
			limiter.isAllowed();
			limiter.isAllowed();
			expect(limiter.isAllowed()).toBe(false);

			// Wait for window to expire
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should allow requests again
			expect(limiter.isAllowed()).toBe(true);
		});

		it('should track remaining requests correctly', () => {
			const limiter = new RateLimiter(5, 1000);

			expect(limiter.getRemaining()).toBe(5);
			limiter.isAllowed();
			expect(limiter.getRemaining()).toBe(4);
			limiter.isAllowed();
			expect(limiter.getRemaining()).toBe(3);
		});

		it('should reset correctly', () => {
			const limiter = new RateLimiter(3, 1000);

			limiter.isAllowed();
			limiter.isAllowed();
			expect(limiter.getRemaining()).toBe(1);

			limiter.reset();
			expect(limiter.getRemaining()).toBe(3);
		});

		it('should handle sliding window correctly', async () => {
			const limiter = new RateLimiter(2, 200); // 2 per 200ms

			limiter.isAllowed(); // t=0
			await new Promise((resolve) => setTimeout(resolve, 100)); // t=100
			limiter.isAllowed(); // t=100
			expect(limiter.isAllowed()).toBe(false); // t=100 (limit reached)

			await new Promise((resolve) => setTimeout(resolve, 120)); // t=220
			// First request should have expired
			expect(limiter.isAllowed()).toBe(true); // t=220
		});
	});
});
