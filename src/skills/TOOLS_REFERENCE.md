# Skills System - Tools Reference

Quick reference for all available tools across the 6 core skills.

## Gmail Skill (11 tools)

| Tool | Description |
|------|-------------|
| `gmail_search` | Search Gmail messages using Gmail search syntax |
| `gmail_send` | Send an email via Gmail |
| `gmail_read` | Read a specific Gmail message by ID |
| `gmail_mark_read` | Mark a Gmail message as read |
| `gmail_delete` | Delete a Gmail message (move to trash) |
| `gmail_list_threads` | List email threads from Gmail |
| `gmail_get_thread` | Get a complete email thread by ID |
| `gmail_list_labels` | List all Gmail labels |
| `gmail_create_label` | Create a new Gmail label |
| `gmail_modify_labels` | Add or remove labels from a message |
| `gmail_list_drafts` | List Gmail draft messages |
| `gmail_create_draft` | Create a new Gmail draft |

## Google Sheets Skill (5 tools)

| Tool | Description |
|------|-------------|
| `sheets_read` | Read data from a Google Sheets spreadsheet |
| `sheets_write` | Write data to a Google Sheets spreadsheet |
| `sheets_append` | Append data to a Google Sheets spreadsheet |
| `sheets_create` | Create a new Google Sheets spreadsheet |
| `sheets_clear` | Clear data from a range in a spreadsheet |

## Google Docs Skill (5 tools)

| Tool | Description |
|------|-------------|
| `docs_read` | Read content from a Google Docs document |
| `docs_create` | Create a new Google Docs document |
| `docs_update` | Update a Google Docs document with batch requests |
| `docs_append` | Append text to the end of a Google Docs document |
| `docs_export` | Export a Google Docs document to various formats |

## Google Calendar Skill (5 tools)

| Tool | Description |
|------|-------------|
| `calendar_list_events` | List events from Google Calendar |
| `calendar_create_event` | Create a new calendar event |
| `calendar_update_event` | Update an existing calendar event |
| `calendar_delete_event` | Delete a calendar event |
| `calendar_get_event` | Get details of a specific calendar event |

## GitHub Skill (6 tools)

| Tool | Description |
|------|-------------|
| `github_repo_info` | Get information about a GitHub repository |
| `github_create_issue` | Create a new issue in a GitHub repository |
| `github_list_issues` | List issues from a GitHub repository |
| `github_create_pr` | Create a new pull request in a GitHub repository |
| `github_search_repos` | Search GitHub repositories |
| `github_clone_repo` | Clone a GitHub repository to local directory |

## Office Skill (8 tools)

| Tool | Description |
|------|-------------|
| `pdf_read` | Read and extract text from a PDF file |
| `pdf_create` | Create a new PDF file from content |
| `excel_read` | Read data from an Excel file |
| `excel_write` | Write data to an Excel file |
| `word_read` | Read text content from a Word document |
| `word_create` | Create a new Word document with structured content |
| `powerpoint_read` | Read content from a PowerPoint presentation |
| `powerpoint_create` | Create a new PowerPoint presentation |

---

## Total: 40 Tools Across 6 Skills

### By Category:
- **Email**: 12 tools (Gmail)
- **Documents**: 10 tools (Docs, Word, PDF)
- **Spreadsheets**: 7 tools (Sheets, Excel)
- **Calendar**: 5 tools
- **Development**: 6 tools (GitHub)
- **Presentations**: 2 tools (PowerPoint)

### Authentication Requirements:
- **Google OAuth**: Gmail, Sheets, Docs, Calendar (28 tools)
- **GitHub CLI**: GitHub (6 tools)
- **No Auth**: Office (8 tools)
