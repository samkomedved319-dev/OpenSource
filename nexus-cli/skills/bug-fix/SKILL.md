---
name: bug-fix
description: Systematic approach to debugging and fixing bugs
version: 1.0.0
triggers: [bug, fix, debug, error, not working, broken, issue]
category: debugging
---

# Bug Fix Skill

## When to use
When the user reports a bug, error, or something not working correctly.

## Steps

1. **Understand the bug**:
   - What is the expected behavior?
   - What is the actual behavior?
   - When does it occur?
   - Can it be reproduced?

2. **Reproduce the bug**:
   - Run the relevant tests or commands
   - Observe the error output
   - Note the exact error message and stack trace

3. **Locate the source**:
   - Use `search_files` to find relevant code
   - Use `read_file` to examine the code
   - Trace the execution path
   - Check recent git changes if applicable

4. **Identify the root cause**:
   - Is it a logic error?
   - Is it a type error?
   - Is it a race condition?
   - Is it a missing dependency?
   - Is it an edge case?

5. **Implement the fix**:
   - Use `edit_file` for targeted changes
   - Make the minimal change needed
   - Don't refactor unrelated code

6. **Verify the fix**:
   - Run the relevant tests
   - Try to reproduce the bug again
   - Check for regressions

7. **Document**:
   - Add comments if the fix is non-obvious
   - Update tests to cover the bug case

## Notes
- Always reproduce before fixing
- Make minimal changes
- Test thoroughly after fixing
- Consider edge cases
