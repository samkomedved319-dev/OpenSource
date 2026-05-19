---
name: react-component
description: Create a React component with TypeScript, proper structure, and best practices
version: 1.0.0
triggers: [react component, create component, new component, react tsx]
category: frontend
---

# React Component Skill

## When to use
When the user asks to create a new React component.

## Steps

1. **Understand requirements**: Read the prompt carefully to understand what the component should do
2. **Check existing patterns**: Look at existing components in the project for conventions
3. **Create the component file**:
   - Use `.tsx` extension
   - Use functional component with TypeScript
   - Export as default
   - Include proper PropTypes/interface for props
4. **Create accompanying files**:
   - Styles (CSS modules, styled-components, or Tailwind based on project)
   - Test file (`ComponentName.test.tsx`)
   - Index file for barrel exports if applicable
5. **Follow project conventions**:
   - Check if project uses named or default exports
   - Check file naming conventions (PascalCase, kebab-case)
   - Check import organization
6. **Verify**: Run the build/lint to ensure no errors

## Template

```tsx
import React from 'react';

interface ComponentNameProps {
  // Define props here
}

export const ComponentName: React.FC<ComponentNameProps> = ({}) => {
  return (
    <div>
      {/* Component content */}
    </div>
  );
};

export default ComponentName;
```

## Notes
- Always read existing components first to match project style
- Use React.FC for functional components
- Define explicit prop interfaces
- Include proper error boundaries if needed
