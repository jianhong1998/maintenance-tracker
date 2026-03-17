---
name: code-review
description: Perform Linus Torvalds-style code review focusing on simplicity, data structures, and pragmatism. Reviews changes for "good taste," complexity, edge cases, and backward compatibility.
---

# Code Review (Linus Torvalds Style)

## What This Skill Does

Performs a systematic code review through the lens of Linus Torvalds' legendary philosophy: obsessive focus on simplicity, data structures over algorithms, elimination of edge cases, and absolute pragmatism. Reviews code changes to identify complexity bloat, poor data design, unnecessary special cases, and backward compatibility issues.

## When To Use

- **Before merging any PR** - Catch design flaws before they become technical debt
- **When reviewing significant refactors** - Ensure simplification, not complexity addition
- **After implementing new features** - Verify "good taste" in design
- **When something feels off** - Trust your intuition, then verify with systematic analysis
- **Before committing to main branches** - Final quality gate

## What Code Review Is NOT

- It is NOT about enforcing arbitrary style preferences or bike-shedding
- It is NOT about being "nice" at the expense of technical truth
- It is NOT about theoretical perfection over practical usability
- It is NOT about adding complexity to handle imaginary edge cases
- It is NOT about breaking existing functionality for "cleanliness"

## The Linus Philosophy

> "Bad programmers worry about the code. Good programmers worry about data structures and their relationships."

### Core Principles

1. **"Good Taste"** - Eliminate special cases; make them the normal case
2. **"Never Break Userspace"** - Backward compatibility is sacred
3. **"Pragmatism"** - Solve real problems, not imaginary ones
4. **"Simplicity"** - If you need more than 3 levels of indentation, redesign it

## Process

### Step 0: Prerequisite Thinking - The Three Questions

Before diving into code, ask yourself:

1. **"Is this solving a real problem or an imaginary one?"**
   - Check commit messages, issue references, user reports
   - Reject over-engineering and premature optimization

2. **"Is there a simpler way?"**
   - Always seek the simplest solution first
   - Complexity is guilty until proven necessary

3. **"Will this break anything?"**
   - Review API changes, interface modifications, behavior changes
   - Backward compatibility is the law

### Step 1: Identify What Changed

```bash
# For PRs or commits
git diff main...HEAD --name-only

# For staged changes
git diff --cached --name-only

# Get the actual diff with context
git diff main...HEAD
```

Review the scope:
- How many files changed?
- What's the blast radius?
- Are there API/interface changes?
- Are there database schema changes?

### Step 2: Five-Layer Linus Analysis

#### Layer 1: Data Structure Analysis

> "Show me your flowcharts and conceal your tables, and I shall continue to be mystified. Show me your tables, and I won't usually need your flowcharts; they'll be obvious."

**Questions to ask:**
- What is the core data? What are its relationships?
- Where does data flow? Who owns it? Who modifies it?
- Is there unnecessary data copying or transformation?
- Can the data structure be simplified to eliminate code?

**Red flags:**
- Multiple representations of the same data
- Excessive data transformations between layers
- Unclear data ownership (who can modify what?)
- Complex state machines that could be simpler with better data design

#### Layer 2: Edge Case Identification

> "Good code has no special cases."

**Questions to ask:**
- Count all `if/else` branches - which are genuine business logic vs. patches for poor design?
- Can you redesign the data structure to eliminate branches?
- Are there null checks that wouldn't be needed with better design?
- Are there multiple code paths doing nearly the same thing?

**Red flags:**
- Functions with more than 3 levels of indentation
- Long chains of `if/else if/else`
- Try-catch blocks wrapping entire functions
- Special handling for "empty" or "null" cases that could be unified

#### Layer 3: Complexity Review

> "If the implementation requires more than 3 levels of indentation, redesign it."

**Questions to ask:**
- What is the essence of this feature? (Explain in one sentence)
- How many concepts does the solution use?
- Can you cut that number in half? And again?
- Would a junior developer understand this in 5 minutes?

**Red flags:**
- Functions longer than 50 lines
- More than 3 levels of nested blocks
- Design patterns used "because we should"
- Abstractions with only one implementation
- "Flexible" code with no actual variability needed

#### Layer 4: Destructive Analysis

> "Never break userspace."

**Questions to ask:**
- What existing features could this affect?
- Are there API contract changes?
- Will existing code still compile/run?
- Are there configuration or data format changes?

**Check:**
```bash
# Check for breaking changes in public APIs
git diff main...HEAD -- '*.ts' '*.js' | grep -E '^[-].*export (class|function|interface|type|const)'

# Check for removed or renamed functions
git diff main...HEAD | grep -E '^[-].*function.*\('

# Check for database migrations
git diff main...HEAD -- '**/migrations/*'
```

**Red flags:**
- Removed or renamed public functions/classes
- Changed function signatures (parameters, return types)
- Database columns removed without migration path
- Configuration keys removed or renamed
- Changed API response formats

#### Layer 5: Practicality Validation

> "Theory and practice sometimes clash. Theory loses. Every single time."

**Questions to ask:**
- Does this problem actually exist in production?
- How many users are genuinely affected?
- Does the solution's complexity match the problem's severity?
- Is this solving a real bug or a theoretical concern?

**Validate:**
```bash
# Check if there's a real issue/bug report
gh issue view <number>

# Check production logs for actual occurrences
# (depends on your logging setup)

# Check test coverage - are tests actually failing?
git diff main...HEAD -- '**/*.test.ts' '**/*.spec.ts'
```

**Red flags:**
- Complex solutions to hypothetical problems
- "What if" scenarios without user evidence
- Defensive programming for impossible states
- Performance optimizations without measurements

### Step 3: The Taste Test

Rate the overall code quality using Linus's standard:

#### 🟢 Good Taste
- Data structures are obvious and elegant
- Special cases have been eliminated
- Code reads like prose - the what and why are clear
- Fewer lines than the previous version
- No indentation deeper than 3 levels

#### 🟡 Mediocre
- Gets the job done but not elegantly
- Has special cases that could be unified
- Readable but not beautiful
- Some unnecessary complexity
- Could be simplified but isn't broken

#### 🔴 Garbage
- Data structures are confusing or duplicated
- Full of special-case handling
- Functions longer than a screen
- Deep nesting (4+ levels)
- Over-engineered or under-engineered
- Breaks backward compatibility without justification

### Step 4: Generate the Review

Output your review in the following format:

```markdown
## Code Review: [Feature/File Name]

### 【Taste Rating】
[🟢 Good Taste / 🟡 Mediocre / 🔴 Garbage]

### 【Prerequisite Check】
1. **Real problem?** [Yes/No] - [Brief explanation]
2. **Simpler way exists?** [Yes/No] - [Alternative if yes]
3. **Breaks anything?** [Yes/No] - [What it breaks if yes]

### 【Five-Layer Analysis】

#### 1. Data Structures
**Assessment:** [Good/Bad]
[Key insights about data design]

**Issues:**
- [Issue 1]
- [Issue 2]

**Recommendation:**
[How to fix the data structure issues]

#### 2. Edge Cases
**Count:** [X special cases found]

**Unnecessary branches:**
- [Branch 1 and why it could be eliminated]
- [Branch 2 and why it could be eliminated]

**Recommendation:**
[How to redesign to eliminate special cases]

#### 3. Complexity
**Function lengths:** [List functions >50 lines]
**Max nesting depth:** [X levels]
**Core concept:** [One-sentence description]

**Issues:**
- [Complexity issue 1]
- [Complexity issue 2]

**Recommendation:**
[How to simplify]

#### 4. Backward Compatibility
**Breaking changes:** [Yes/No]

[If yes, list them:]
- [Change 1]
- [Change 2]

**Recommendation:**
[How to maintain compatibility or justify the break]

#### 5. Practicality
**Real problem:** [Yes/No]
**Affected users:** [Estimate or "Unknown"]
**Solution complexity:** [Appropriate/Overkill/Insufficient]

**Recommendation:**
[Adjust scope or approach if needed]

### 【Critical Issues】 (if any)
- ❌ **[Issue]** - [Why it's critical] - [How to fix]

### 【Final Verdict】

[Choose one:]

✅ **SHIP IT**
[Brief reason why this is good]

🟡 **FIX BEFORE MERGE**
[List of must-fix items]

❌ **RETHINK THIS**
[Why this approach is fundamentally flawed and what to do instead]

### 【Linus Would Say】
[A direct, sharp, Linus-style comment on the code - be honest but constructive]
```

## Key Principles

1. **Data structures first, algorithms second** - A good data structure makes code obvious
2. **Eliminate, don't accumulate** - Remove special cases rather than handling them
3. **Simplicity is not optional** - Complex solutions to simple problems are bugs
4. **Backward compatibility is sacred** - Breaking users is never acceptable without overwhelming justification
5. **Real problems only** - Don't solve imaginary issues
6. **Code must be readable** - If it needs detailed comments to explain what it does, rewrite it
7. **Be brutally honest** - Kindness to bad code is cruelty to users and future maintainers

## Examples of Good Taste

### Bad: Special Case Handling
```typescript
function deleteNode(list: LinkedList, node: Node) {
  if (list.head === node) {
    list.head = node.next;
  } else {
    let prev = list.head;
    while (prev.next !== node) {
      prev = prev.next;
    }
    prev.next = node.next;
  }
}
```

### Good: Eliminate the Special Case
```typescript
function deleteNode(entry: NodeEntry) {
  entry.prev.next = entry.next;
  entry.next.prev = entry.prev;
}
// Use sentinel nodes so head is never special
```

---

### Bad: Over-Engineered
```typescript
class AbstractFactoryBuilderInterface {
  createBuilder(): BuilderFactory {
    return new ConcreteBuilderFactoryImpl();
  }
}
```

### Good: Just Do The Thing
```typescript
function createUser(data: UserData): User {
  return { ...data, createdAt: Date.now() };
}
```

---

### Bad: Deep Nesting
```typescript
function processData(data: Data[]) {
  if (data) {
    if (data.length > 0) {
      for (const item of data) {
        if (item.valid) {
          if (item.type === 'special') {
            // do something
          } else {
            // do something else
          }
        }
      }
    }
  }
}
```

### Good: Early Returns
```typescript
function processData(data: Data[]) {
  if (!data?.length) return;

  for (const item of data) {
    if (!item.valid) continue;

    item.type === 'special'
      ? handleSpecial(item)
      : handleNormal(item);
  }
}
```

## Tips for Reviewers

1. **Start with data structures** - If the data model is wrong, the code will always be messy
2. **Count the ifs** - Each conditional is a code smell until proven necessary
3. **Read the diff, not just the code** - What changed matters more than the final state
4. **Check tests** - Are they testing real behavior or implementation details?
5. **Think like a user** - Will this break someone's workflow?
6. **Be direct** - "This function is too complex" is better than "Maybe we could consider possibly simplifying this if you think that would be beneficial"
7. **Show, don't tell** - Provide concrete examples of how to fix issues

## Integration with Development Workflow

This skill works best when combined with:

- **regression-testing** - After identifying issues, verify no regressions
- **test-driven-development** - Good tests reveal design flaws early
- **systematic-debugging** - When code review reveals bugs, debug systematically

## Remember

> "Talk is cheap. Show me the code."
> — Linus Torvalds

The goal is not to be mean, but to be honest. Bad code has real costs: harder maintenance, more bugs, slower development, and ultimately, unhappy users. Good code review is an act of service to the codebase, the team, and the users.
