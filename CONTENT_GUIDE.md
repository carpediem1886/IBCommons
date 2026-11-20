# Adding content to IBCommons

All content lives in `content/<subject>/<programme>/` as JSON. After any change, run:

```bash
python3 tools/build_index.py
```

This checks every file and rebuilds `index.json`. The site only shows content listed there.

## Maths and formatting

- Inline maths: `$F = ma$`. Display maths: `$$E_k = \tfrac{1}{2}mv^2$$`. In JSON, every backslash is written twice: `"$3.0\\text{ m s}^{-1}$"`.
- `**bold**`, `*italic*`, a blank line starts a new paragraph, and lines starting with `- ` make a list.
- PDFs turn simple LaTeX into plain text (Greek letters, powers, subscripts, `\frac`, `\sqrt`, `\times`). Keep maths in questions simple so it prints cleanly.
- Images: put them in `content/<subject>/<programme>/img/` and reference them as `"image": "content/physics/dp/img/a2-trolley.png"`. Use PNG, JPG or SVG.

## Questions: `questions/<subtopic code>.json`

Each file holds a list of questions. Put each question in the file for its main sub-topic.

### Multiple choice

```json
{
  "id": "phys-dp-A2-001",
  "paper": "1A",
  "level": "SL",
  "subtopics": ["A.2"],
  "stem": "A $2.0\\text{ kg}$ trolley ... What is the speed after the collision?",
  "options": ["1.0 m/s", "1.5 m/s", "2.0 m/s", "3.0 m/s"],
  "answer": "C",
  "markscheme": ["Momentum is conserved: ..."],
  "source": "IBCommons original"
}
```

### Structured (one or more parts)

```json
{
  "id": "phys-dp-A2-003",
  "paper": "2",
  "level": "SL",
  "subtopics": ["A.2"],
  "stem": "A car of mass $1200\\text{ kg}$ ...",
  "image": "content/physics/dp/img/car.png",
  "parts": [
    {
      "label": "a",
      "marks": 1,
      "text": "Calculate the deceleration.",
      "answer": { "value": 5.0, "unit": "m s^{-2}", "tolerance": 0.02 },
      "markscheme": ["$a = 15 / 3.0 = 5.0\\text{ m s}^{-2}$"]
    },
    {
      "label": "b",
      "marks": 2,
      "text": "Explain why ...",
      "markscheme": ["first marking point", "second marking point"]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Unique and never changed. Pattern: `subject-programme-subtopic-number`. |
| `paper` | A paper `id` from `syllabus.json`. DP: `1A`, `1B`, `2`. MYP: `A`–`D` (criteria). |
| `level` | `SL` (shown to SL and HL students) or `HL` (HL only). Leave it out for MYP. |
| `subtopics` | One or more sub-topic codes. |
| `answer` (part) | Optional. Add it for numerical answers: the site then checks the number instantly. `tolerance` is relative (0.02 = ±2 %). Without it, the AI marks the answer against the markscheme. |
| `markscheme` | One string per marking point, one mark each. |
| `source` | Where the question comes from. |

## Revision lessons: `revision/<subtopic code>.json`

```json
{
  "code": "A.2",
  "title": "Forces and momentum",
  "minutes": 25,
  "intro": "One or two sentences on why this matters.",
  "objectives": ["Use Newton's three laws", "..."],
  "steps": [
    {
      "title": "Newton's second law",
      "body": "Text with **bold** and $maths$.",
      "formula": "$$F = ma$$",
      "figure": { "svg": "<svg ...>...</svg>", "caption": "..." },
      "key": "A key idea box.",
      "example": "A worked example.",
      "check": { "question": "...", "options": ["...", "..."], "answer": "B", "explain": "..." }
    }
  ]
}
```

Every step field except `title` is optional. A figure can be an inline `svg` or `{ "src": "path/to/image.png" }`. A step with a `check` must be answered correctly before the student can move on.

Lesson SVGs are inserted into the page as they are, so review them in pull requests. Use the brand colours: navy `#13233A`, teal `#0E9F8E`, orange `#F2994A` (sparingly), slate `#5B6575`.

## Copyright

Only add material you have the right to publish. Official IB past papers, markschemes and subject guides, and commercial textbooks, are copyrighted. Use them to understand the syllabus and the style of questions, then write **original** questions and explanations.
