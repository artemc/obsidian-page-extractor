# Obsidian Page Extractor

An Obsidian plugin to extract text and content from PDF files and process it with AI.

## Features

### PDF Text Extraction

- **Extract from Single Page**: Right-click on a page in a PDF view (works best with the [PDF++ plugin](https://github.com/Mob-sakai/obsidian-pdf-plus)) and extract its text content.
- **Extract Selected Text**: Extract only the text you've selected on a PDF page.
- **Extract Full PDF**: Right-click a PDF file in the file explorer to extract the text from all its pages into a single note.
- **Extract All Pages to Separate Notes**: Extract each page of a PDF into its own note.

### Note Creation & Management

- **Create or Append**: Create a new note with the extracted text or append it to your currently active note.
- **Append to Rightmost**: Option to append text to the note in the right-most pane, perfect for a "scratchpad" workflow.
- **Customizable Note Names**: Use templates to define how your new notes are named. Use placeholders like `{{date}}`, `{{time}}`, `{{pdf}}` (the PDF's name), and `{{page}}`.
- **Organize Your Notes**: Automatically save new notes to a specific folder.
- **Split-Screen Workflow**: New notes can be automatically opened in a new pane to the right.
- **Automatic Linking**: New notes automatically include a link back to the page of the PDF they came from (e.g., `[[MyDocument.pdf#page=12]]`).

### AI-Powered Content Analysis

- **Analyze Your Notes**: Use AI to process the content of your current note. This can summarize text, add tags, or even suggest a new title.
- **Flexible AI Providers**:
  - **Ollama**: Connect to your own self-hosted Ollama instance.
  - **Gemini**: Use the Gemini API for powerful AI processing.
- **Intelligent Content Generation**:
  - **Update Frontmatter**: The AI can automatically add or update the YAML frontmatter of your note (e.g., adding `tags: [summary, project-x]`).
  - **Prepend Content**: The AI's response can be automatically added to the beginning of your note.
  - **Automatic Renaming**: The AI can suggest a new, more descriptive name for your note and rename the file automatically.
- **Customizable Prompts**: Fine-tune the AI's behavior by creating your own prompts in a separate `.md` file or directly in the plugin's settings.
- **Easy Access**: A ribbon icon allows you to trigger the AI analysis with a single click.

## How to Use

1.  **Open a PDF**: Open a PDF file in Obsidian. For the best experience, use the [PDF++ plugin](https://github.com/Mob-sakai/obsidian-pdf-plus) to view the PDF inside a note.
2.  **Right-Click to Extract**:
    - **In a PDF view**: Right-click on a page to see the extraction options.
    - **On a file**: Right-click a PDF in the file explorer for full-document extraction options.
3.  **Use Commands**: Access the extraction options through the command palette (`Cmd/Ctrl + P`).
4.  **Analyze with AI**:
    - Open a note you want to analyze.
    - Click the lightbulb icon in the ribbon or run the "AI Analyze Current Note" command.

## Example prompt

See [`examples/ai-analyze-prompt.md`](examples/ai-analyze-prompt.md): put a copy in your vault and set its path in **AI Prompt File**.

## Installation

Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<vault>/.obsidian/plugins/obsidian-page-extractor/` and enable the plugin in Obsidian.

## Development

```bash
npm install
npm run build   # type check + production build -> main.js
npm run dev     # rebuild on changes
```

Release: bump the version (`npm version <x.y.z>` updates `manifest.json` and `versions.json`), push the tag; GitHub Actions builds the plugin and attaches `main.js`, `manifest.json`, `styles.css` to the release.

## Settings

The plugin provides a comprehensive settings tab to configure:
- Default extraction modes (new note vs. current note).
- Note naming templates and save folders.
- AI provider (Ollama/Gemini), API keys, models, and prompts.
- Frontmatter fields to write as wikilinks or as quoted strings.
- And much more.
