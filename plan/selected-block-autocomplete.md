# Selected block autocomplete

## Goal
Implement the selected AI-FILL contract while preserving all source outside the editor selection. No route names or user prompt phrases control generation.

## Decisions
- Parse the whole Python file for imports and the enclosing function arguments. Send dependency names as context, not replayable declarations or unrelated AI-FILL bodies.
- Give ORM selections a small Tina4 framework example. The selected comments supply the actual task, model names and return contract.
- Keep generation separate from insertion. Normalize indentation, reject fences/placeholders/duplicate source, validate reconstructed Python syntax and the explicit Return call contract.
- Reject enclosing declarations for statement selections. Never salvage a whole generated file by guessing which function to take.
- Retry with the concrete validation failure, bounded to three attempts.
- Tab applies exactly the captured range; selection changes invalidate late responses.

## Evidence
- TypeScript check passed; 44 unit tests passed, no skips.
- Actual split editor at port 7146: selected list_cars AI-FILL comments and placeholder, received Car import + Car.all() + response serialization, accepted Tab, saved.
- Compared saved file to pretest copy: prefix and suffix unchanged; no duplicate functions or Markdown fences.
- Executed the saved list_cars function using real Tina4 ORM, SQLite and Response with a temporary Car model. Empty and populated collections passed.
- Playground lacks src/orm/Car.py: live endpoint functionality is not claimed. Other CRUD placeholders remain untouched.

## Limits
Syntax and scope validation do not prove arbitrary generated code is semantically correct. Python uses parsed dependency context; other languages retain surrounding source. Live tests use the current local model and are not a reliability guarantee across all tasks.
