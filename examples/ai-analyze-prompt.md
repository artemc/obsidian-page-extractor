# Task
You analyze the text of a document (an article, a paper, meeting notes or a book chapter).

# Response
Respond with a single JSON object. All fields are optional:

- `frontmatter` - metadata for the note:
  - `type` - kind of document (article, paper, notes, chapter, other);
  - `title` - document title in sentence case;
  - `author` - author names, as a list;
  - `date` - publication date in YYYY-MM-DD, if present;
  - `tags` - 3-5 short lowercase topic tags.
- `note_name` - file name in the format "YYMMDD Title", using the document date
  if known.
- `note_text` - a summary of 3-5 bullet points with the key ideas.

# Rules
- Use only facts present in the text; do not invent dates or names.
- Do not wrap the JSON in code fences.
