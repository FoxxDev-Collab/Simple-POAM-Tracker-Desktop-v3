# POAM Tracker - Brand Guidelines

## 🎯 Brand Identity

### Product Name
**Primary:** POAM Tracker
**Full:** POAM Tracker - Security Compliance Management
**Tagline:** "Security Compliance Made Simple"

### Mission Statement
Streamlining security compliance management through intuitive Plan of Action & Milestones tracking, enabling organizations to maintain robust cybersecurity postures with clarity and efficiency.

## 🎨 Visual Identity

### Logo Usage
- **Primary Logo:** Shield-based design with gradient blue background
- **Icon Version:** For favicon, app icons, and small spaces
- **Monochrome:** For single-color applications
- **Minimum Size:** 16px (for digital), 0.5" (for print)

### Color Palette

#### Primary Colors
```css
--primary: #3B82F6 (Blue 500)
--primary-hover: #2563EB (Blue 600)
--primary-subtle: #EFF6FF (Blue 50)
```

#### Secondary Colors
```css
--secondary: #F1F5F9 (Slate 100)
--secondary-hover: #E2E8F0 (Slate 200)
```

#### Status Colors
```css
--success: #059669 (Emerald 600)
--warning: #D97706 (Amber 600)
--destructive: #DC2626 (Red 600)
```

#### Neutral Grays
```css
--gray-50: #F8FAFC
--gray-100: #F1F5F9
--gray-200: #E2E8F0
--gray-300: #CBD5E1
--gray-400: #94A3B8
--gray-500: #64748B
--gray-600: #475569
--gray-700: #334155
--gray-800: #1E293B
--gray-900: #0F172A
```

### Typography

#### Primary Font: Inter
- **Headers:** Inter, 600 weight
- **Body Text:** Inter, 400 weight
- **UI Elements:** Inter, 500 weight

#### Monospace Font: JetBrains Mono
- **Code blocks**
- **Data display**
- **Technical content**

### Spacing & Layout

#### Border Radius
```css
--radius: 0.5rem (8px)
--radius-sm: 0.25rem (4px)
--radius-md: 0.375rem (6px)
--radius-lg: 0.5rem (8px)
--radius-xl: 0.75rem (12px)
```

#### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)
--shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1)
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)
--shadow-brand: 0 4px 14px 0 rgb(59 130 246 / 0.15)
```

## 🖼️ UI Components

### Navigation
- Clean, minimal sidebar design
- Clear iconography with Lucide React icons
- Subtle hover states and active indicators
- Collapsible for focused work

### Cards & Containers
- Consistent border radius (8px)
- Subtle shadows for depth
- Clean borders using `--border` color
- Proper padding and spacing

### Buttons
- Primary: Blue with white text
- Secondary: Gray outline with dark text
- Destructive: Red for dangerous actions
- Ghost: Transparent with hover states

### Status Indicators
- **Complete:** Green circle with checkmark
- **In Progress:** Amber circle with dot
- **Overdue/Critical:** Red circle with line
- **Pending:** Gray circle

## 📱 Application Standards

### Window Titles
- **Main App:** "POAM Tracker - Security Compliance Management"
- **Modals:** "[Action] - POAM Tracker"

### File Naming
- Use kebab-case for files: `poam-tracker.tsx`
- Use PascalCase for components: `POAMTracker`
- Use camelCase for functions: `createNewPOAM`

### Content Tone
- **Professional** but approachable
- **Clear** and concise
- **Action-oriented** for buttons and CTAs
- **Helpful** for error messages and guidance

## 🎯 Brand Applications

### Desktop Application
- Clean, modern interface
- Focus on data clarity and workflow efficiency
- Consistent spacing and alignment
- Professional color scheme suitable for enterprise use

### Icons & Assets
- Consistent style across all icons
- Meaningful symbols that relate to security/compliance
- Scalable vector formats (SVG preferred)
- High contrast for accessibility

### Documentation
- Clear headings and structure
- Code examples with syntax highlighting
- Screenshots with consistent styling
- Professional formatting

## ♿ Accessibility

### Color Contrast
- Minimum WCAG AA compliance (4.5:1 for normal text)
- AAA preferred for critical content (7:1)
- Never rely solely on color for information

### Typography
- Minimum 16px font size for body text
- Clear hierarchy with consistent sizing
- Sufficient line height (1.5 or greater)

### Interactive Elements
- Minimum 44px touch targets
- Clear focus indicators
- Keyboard navigation support
- Screen reader friendly

## 🚀 Implementation Guidelines

### CSS Variables
Use CSS custom properties for all brand colors and spacing:
```css
background-color: hsl(var(--primary));
color: hsl(var(--primary-foreground));
```

### Component Naming
Follow consistent naming patterns:
- `Button`, `Card`, `Modal` for UI components
- `POAMTracker`, `MilestoneManager` for feature components
- `useAuth`, `useToast` for custom hooks

### File Organization
```
src/
├── components/
│   ├── ui/          # Reusable UI components
│   ├── features/    # Feature-specific components
│   └── layout/      # Layout components
├── styles/
│   ├── globals.css  # Global styles and variables
│   └── components/  # Component-specific styles
└── assets/
    ├── icons/       # SVG icons
    └── images/      # Brand assets
```

---

*Brand Guidelines v1.0 - Last updated: 2025* 