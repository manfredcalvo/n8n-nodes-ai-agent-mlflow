/**
 * Retry utilities test suite
 *
 * Tests for token masking and credential handling
 */

import { maskCredentials, maskTokensInText } from '../retry';

describe('Retry Utilities', () => {
	describe('maskCredentials', () => {
		it('should mask Databricks host correctly', () => {
			const creds = {
				host: 'https://adb-12345.6.azuredatabricks.net',
				token: 'dapi1234567890abcdefghijklmnop',
			};

			const masked = maskCredentials(creds);
			expect(masked.host).toBe('https://adb-12345.***');
			expect(masked.host).not.toContain('azuredatabricks');
		});

		it('should mask token to show only first 4 chars', () => {
			const creds = {
				host: 'https://test.cloud.databricks.com',
				token: 'dapi1234567890abcdefghijklmnop',
			};

			const masked = maskCredentials(creds);
			expect(masked.token).toBe('dapi****');
			expect(masked.token).not.toContain('567890');
		});

		it('should handle short tokens', () => {
			const creds = {
				host: 'https://test.com',
				token: 'abc',
			};

			const masked = maskCredentials(creds);
			expect(masked.token).toBe('***');
		});

		it('should handle missing credentials', () => {
			const creds = {};

			const masked = maskCredentials(creds);
			expect(masked.host).toBe('***');
			expect(masked.token).toBe('***');
		});

		it('should handle undefined values', () => {
			const creds = {
				host: undefined,
				token: undefined,
			};

			const masked = maskCredentials(creds);
			expect(masked.host).toBe('***');
			expect(masked.token).toBe('***');
		});
	});

	describe('maskTokensInText', () => {
		it('should mask Databricks tokens (dapi...)', () => {
			const text = 'Authentication failed with token: dapi1234567890abcdefghijklmnop';
			const masked = maskTokensInText(text);

			expect(masked).toContain('dapi****');
			expect(masked).not.toContain('567890');
		});

		it('should mask generic long tokens (40+ chars)', () => {
			const text = 'Token: abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz';
			const masked = maskTokensInText(text);

			expect(masked).toContain('****');
			expect(masked).not.toContain('abcdefghijklmnopqrstuvwxyz12345');
		});

		it('should mask Bearer tokens in headers', () => {
			const text = 'Authorization: Bearer dapi1234567890abcdefghijklmnop failed';
			const masked = maskTokensInText(text);

			expect(masked).toContain('Bearer ****');
			expect(masked).not.toContain('dapi123');
		});

		it('should mask multiple tokens in same text', () => {
			const text =
				'Failed with Bearer dapi123456789012345678901234567890 and token abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz';
			const masked = maskTokensInText(text);

			expect(masked).toContain('Bearer ****');
			expect(masked).not.toContain('dapi123456789012345678901234567890');
			expect(masked).not.toContain('abcdefghijklmnopqrstuvwxyz12345');
		});

		it('should not mask short tokens', () => {
			const text = 'Short token: abc123';
			const masked = maskTokensInText(text);

			expect(masked).toBe(text);
		});

		it('should handle text without tokens', () => {
			const text = 'This is a normal error message';
			const masked = maskTokensInText(text);

			expect(masked).toBe(text);
		});

		it('should be case insensitive for Bearer tokens', () => {
			const textLower = 'authorization: bearer dapi12345678901234567890';
			const textUpper = 'AUTHORIZATION: BEARER dapi12345678901234567890';

			expect(maskTokensInText(textLower)).toContain('Bearer ****');
			expect(maskTokensInText(textUpper)).toContain('Bearer ****');
		});

		it('should mask tokens in stack traces', () => {
			const stackTrace = `Error: Authentication failed
    at MLflowClient.authenticate (mlflow.js:123)
    at processTicksAndRejections (internal/process/task_queues.js:95)
    Token used: dapi1234567890abcdefghijklmnop1234567890
    Host: https://adb-12345.azuredatabricks.net`;

			const masked = maskTokensInText(stackTrace);

			expect(masked).toContain('dapi****');
			expect(masked).not.toContain('567890abcdef');
		});
	});
});
