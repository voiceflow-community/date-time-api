import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Dockerfile Validation Tests', () => {
  let dockerfileContent: string;
  let dockerignoreContent: string;

  beforeAll(() => {
    dockerfileContent = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8');
    dockerignoreContent = readFileSync(join(process.cwd(), '.dockerignore'), 'utf8');
  });

  describe('Dockerfile Structure', () => {
    it('should have multi-stage build with builder and production stages', () => {
      expect(dockerfileContent).toContain('FROM node:20-alpine AS builder');
      expect(dockerfileContent).toContain('FROM node:20-alpine AS production');
    });

    it('should use Node.js 20 Alpine base image for minimal size', () => {
      expect(dockerfileContent).toContain('node:20-alpine');
    });

    it('should create non-root user for security', () => {
      expect(dockerfileContent).toContain('addgroup -g 1001 -S nodejs');
      expect(dockerfileContent).toContain('adduser -S nodeuser -u 1001');
      expect(dockerfileContent).toContain('USER nodeuser');
    });

    it('should install security updates and dumb-init', () => {
      expect(dockerfileContent).toContain('apk update');
      expect(dockerfileContent).toContain('apk upgrade');
      expect(dockerfileContent).toContain('apk add --no-cache dumb-init');
    });

    it('should have proper working directory setup', () => {
      expect(dockerfileContent).toContain('WORKDIR /app');
    });

    it('should copy package files first for better layer caching', () => {
      const packageCopyIndex = dockerfileContent.indexOf('COPY package*.json ./');
      const sourceCopyIndex = dockerfileContent.indexOf('COPY . .');
      expect(packageCopyIndex).toBeGreaterThan(-1);
      expect(sourceCopyIndex).toBeGreaterThan(-1);
      expect(packageCopyIndex).toBeLessThan(sourceCopyIndex);
    });

    it('should build the application in builder stage', () => {
      expect(dockerfileContent).toContain('npm run build');
    });

    it('should prune dev dependencies after build', () => {
      expect(dockerfileContent).toContain('npm prune --production');
    });

    it('should copy built application from builder stage', () => {
      expect(dockerfileContent).toContain('COPY --from=builder');
      expect(dockerfileContent).toContain('/app/dist ./dist');
      expect(dockerfileContent).toContain('/app/node_modules ./node_modules');
    });

    it('should expose port 3000', () => {
      expect(dockerfileContent).toContain('EXPOSE 3000');
    });

    it('should set production environment variables', () => {
      expect(dockerfileContent).toContain('ENV NODE_ENV=production');
      expect(dockerfileContent).toContain('ENV PORT=3000');
    });

    it('should use dumb-init as entrypoint for proper signal handling', () => {
      expect(dockerfileContent).toContain('ENTRYPOINT ["dumb-init", "--"]');
    });

    it('should start the application with node command', () => {
      expect(dockerfileContent).toContain('CMD ["node", "dist/index.js"]');
    });
  });

  describe('Health Check Configuration', () => {
    it('should have health check configuration', () => {
      expect(dockerfileContent).toContain('HEALTHCHECK');
    });

    it('should have proper health check intervals and timeouts', () => {
      expect(dockerfileContent).toContain('--interval=30s');
      expect(dockerfileContent).toContain('--timeout=3s');
      expect(dockerfileContent).toContain('--start-period=5s');
      expect(dockerfileContent).toContain('--retries=3');
    });

    it('should check the /health endpoint', () => {
      expect(dockerfileContent).toContain("path: '/health'");
    });

    it('should handle health check timeouts and errors', () => {
      expect(dockerfileContent).toContain("req.on('error', () => process.exit(1))");
      expect(dockerfileContent).toContain("req.on('timeout'");
    });
  });

  describe('Security Optimizations', () => {
    it('should set proper file ownership for non-root user', () => {
      expect(dockerfileContent).toContain('--chown=nodeuser:nodejs');
      expect(dockerfileContent).toContain('chown -R nodeuser:nodejs /app');
    });

    it('should clean package manager cache', () => {
      expect(dockerfileContent).toContain('npm cache clean --force');
    });

    it('should remove apk cache', () => {
      expect(dockerfileContent).toContain('rm -rf /var/cache/apk/*');
    });
  });

  describe('Dockerignore Configuration', () => {
    it('should ignore node_modules', () => {
      expect(dockerignoreContent).toContain('node_modules');
    });

    it('should ignore build outputs', () => {
      expect(dockerignoreContent).toContain('dist');
    });

    it('should ignore development files', () => {
      expect(dockerignoreContent).toContain('.env');
      expect(dockerignoreContent).toContain('.vscode');
      expect(dockerignoreContent).toContain('*.log');
    });

    it('should ignore git files', () => {
      expect(dockerignoreContent).toContain('.git');
      expect(dockerignoreContent).toContain('.gitignore');
    });

    it('should ignore Docker files', () => {
      expect(dockerignoreContent).toContain('Dockerfile*');
      expect(dockerignoreContent).toContain('docker-compose*');
      expect(dockerignoreContent).toContain('.dockerignore');
    });

    it('should ignore test and documentation files', () => {
      expect(dockerignoreContent).toContain('README.md');
      expect(dockerignoreContent).toContain('coverage');
      expect(dockerignoreContent).toContain('.kiro/');
    });
  });

  describe('Build Optimization', () => {
    it('should use npm ci for faster, reliable builds', () => {
      expect(dockerfileContent).toContain('npm ci');
    });

    it('should install production dependencies only in production stage', () => {
      // Builder stage should install all dependencies
      const builderSection = dockerfileContent.substring(
        dockerfileContent.indexOf('FROM node:20-alpine AS builder'),
        dockerfileContent.indexOf('FROM node:20-alpine AS production')
      );
      expect(builderSection).toContain('npm ci --only=production=false');
      
      // Production stage should copy pruned dependencies
      const productionSection = dockerfileContent.substring(
        dockerfileContent.indexOf('FROM node:20-alpine AS production')
      );
      expect(productionSection).toContain('COPY --from=builder');
    });
  });
});

function beforeAll(fn: () => void) {
  fn();
}