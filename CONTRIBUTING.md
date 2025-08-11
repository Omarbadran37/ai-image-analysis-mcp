# Contributing to AI Image Analysis MCP

Thank you for your interest in contributing to the AI Image Analysis MCP! This project is open source and welcomes contributions from the community.

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript >= 5.6.0
- Google AI Studio account for Gemini API access

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-username/ai-image-analysis-mcp.git
cd ai-image-analysis-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with your actual API keys
```

## 🛠️ Development Workflow

### Making Changes
1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** following the coding standards below
4. **Test your changes** thoroughly
5. **Commit your changes**: `git commit -m "feat: your feature description"`
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Create a Pull Request**

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Add proper type definitions
- Include JSDoc comments for public APIs
- Use meaningful variable and function names

### Testing
- Test your changes with both local MCP server and Supabase Edge Functions
- Verify security features are working correctly
- Test with different image types and formats
- Ensure no sensitive data is logged or exposed

## 📋 Types of Contributions

### 🐛 Bug Reports
Please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)
- Any error messages or logs

### ✨ Feature Requests
Please include:
- Clear description of the proposed feature
- Use cases and benefits
- Potential implementation approach
- Any breaking changes

### 🔧 Code Contributions
Areas where contributions are welcome:
- Additional image analysis capabilities
- Performance improvements
- Security enhancements
- Documentation improvements
- Testing and quality assurance
- Bug fixes and issue resolution

## 🔐 Security Guidelines

### Important Security Practices
- **Never commit API keys or sensitive data**
- **Use placeholder values in examples**
- **Validate all user inputs**
- **Follow secure coding practices**
- **Report security vulnerabilities privately**

### Reporting Security Issues
For security-related issues, please email the maintainers directly rather than creating a public issue.

## 📝 Pull Request Guidelines

### Before Submitting
- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm run build`)
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventional format
- [ ] No sensitive data is included

### PR Description
Please include:
- Summary of changes
- Motivation and context
- How changes were tested
- Screenshots (if applicable)
- Breaking changes (if any)

## 🏗️ Project Structure

```
ai-image-analysis-mcp/
├── src/
│   ├── modules/          # Core functionality modules
│   ├── utils/            # Utility functions
│   ├── index.ts          # Local MCP server
│   └── *.ts              # Other TypeScript files
├── supabase/
│   ├── functions/        # Edge Functions
│   └── *.sql             # Database schema
├── examples/             # Usage examples
├── docs/                 # Documentation files
└── tests/                # Test files (when added)
```

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers get started
- Celebrate others' contributions

### Getting Help
- Check existing documentation first
- Search issues for similar problems
- Ask questions in discussions
- Be patient and respectful

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors will be recognized in the project's README and release notes. Thank you for helping make this project better!

---

**Happy Contributing!** 🎉