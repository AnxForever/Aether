# Contributing to Aether

Thank you for your interest in contributing to Aether! This document provides guidelines and instructions for contributing.

## 🎯 Ways to Contribute

- **Report Bugs**: Submit detailed bug reports with reproduction steps
- **Suggest Features**: Propose new features or improvements
- **Write Code**: Fix bugs or implement new features
- **Improve Documentation**: Enhance docs, add examples, fix typos
- **Write Tests**: Add test coverage for existing code
- **Review PRs**: Help review pull requests from other contributors

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- Git
- TypeScript knowledge

### Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/aether.git
cd aether

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Build the project
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

## 📝 Contribution Workflow

### 1. Create an Issue

Before starting work, create an issue to discuss:
- Bug reports: Include reproduction steps, expected vs actual behavior
- Feature requests: Describe the use case and proposed solution
- Questions: Ask for clarification before implementing

### 2. Fork and Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 3. Make Changes

- Follow the existing code style (enforced by ESLint + Prettier)
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed

### 4. Test Your Changes

```bash
# Run linter
npm run lint

# Run tests
npm test

# Run type checking
npm run typecheck

# Format code
npm run format
```

### 5. Commit Your Changes

Use conventional commits format:

```
<type>: <description>

[optional body]
[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```bash
git commit -m "feat: add support for custom model parameters"
git commit -m "fix: resolve memory leak in stream processing"
git commit -m "docs: update installation instructions"
```

### 6. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create PR on GitHub
# - Use descriptive title
# - Reference related issues
# - Describe what changed and why
# - Add screenshots for UI changes
```

## 📋 Code Style Guidelines

### TypeScript

- Use **strict mode** (configured in tsconfig.json)
- Prefer `const` over `let`
- Use explicit types when clarity is needed
- Document public APIs with JSDoc comments
- Avoid `any` types when possible

### Naming Conventions

- **Files**: kebab-case (`user-manager.ts`)
- **Classes**: PascalCase (`UserManager`)
- **Functions**: camelCase (`getUserData`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_TIMEOUT`)
- **Interfaces**: PascalCase (`UserData`)

### File Structure

```typescript
/**
 * Module description
 */

// Imports
import { Type } from './types';

// Constants
const MAX_RETRIES = 3;

// Types/Interfaces
export interface Config {
  // ...
}

// Main class/function
export class MyClass {
  // ...
}
```

## 🧪 Testing Guidelines

- Write tests for all new features
- Aim for >80% code coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

```typescript
describe('FeatureName', () => {
  it('should do something when condition is met', () => {
    // Arrange
    const input = createTestData();

    // Act
    const result = processInput(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

## 📚 Documentation

When adding new features:
- Update README.md if needed
- Add JSDoc comments to public APIs
- Create examples in `/examples`
- Update CHANGELOG.md

## 🔒 Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Report security vulnerabilities privately to the maintainers
- Follow secure coding practices

## 📞 Getting Help

- **Questions**: Open a GitHub Discussion
- **Bug Reports**: Open an Issue
- **Feature Requests**: Open an Issue
- **Security Issues**: Email maintainers privately

## ✅ PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines (lint passes)
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] Commits follow conventional format
- [ ] PR description is clear and complete
- [ ] Related issues are referenced
- [ ] Code is formatted with Prettier

## 🎉 Recognition

Contributors will be:
- Listed in README.md
- Mentioned in CHANGELOG.md
- Credited in release notes

Thank you for contributing to Aether! 🚀
