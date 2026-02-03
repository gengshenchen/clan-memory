---
description: Code style and commit conventions
---

# Code Style Conventions

## Language Requirements

1. **Git Commits**: All commit messages MUST be in English
2. **Source Code**: All code files MUST use English for:
   - Variable names
   - Function names
   - Class names
   - Comments
   - Documentation strings
3. **Explanations**: When explaining code to users, Chinese can be used for clarity, but the actual source files must remain in English

## Commit Message Format

Use conventional commits format:
```
<type>(<scope>): <description>

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `style`: Code style changes (formatting, etc.)
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(media-player): add video thumbnail generation

- Generate thumbnails from video at 1 second mark
- Display thumbnails in playlist sidebar
- Show placeholder icon when generation fails
```
